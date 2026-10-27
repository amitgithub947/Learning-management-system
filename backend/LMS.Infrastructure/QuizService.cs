using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure;

public sealed class QuizService(ApplicationDbContext db, ICurrentUser user, CourseAccess access, ICompletionService completion, IUnitOfWork work, TimeProvider clock) : IQuizService
{
    public Task<QuizDto> CreateAsync(QuizRequest r, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        await access.RequireManageAsync(r.CourseId, token); await completion.EnsureCurriculumMutableAsync(r.CourseId, token); Validate(r);
        var quiz = new Quiz { CourseId = r.CourseId }; Apply(quiz, r); db.Quizzes.Add(quiz); AddQuestions(quiz.Id, r.Questions); await db.SaveChangesAsync(token);
        await completion.RecalculateCourseAsync(quiz.CourseId, token); return await BuildQuizAsync(quiz, true, token);
    }, ct);
    public Task<QuizDto> UpdateAsync(Guid id, QuizRequest r, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        var quiz = await FindAsync(id, token); await access.RequireManageAsync(quiz.CourseId, token); await completion.EnsureCurriculumMutableAsync(quiz.CourseId, token); Validate(r);
        if (r.CourseId != quiz.CourseId) throw new AppException(400, "A quiz cannot be moved to another course.");
        if (await db.QuizAttempts.AnyAsync(a => a.QuizId == id, token)) throw AppException.Conflict("Quizzes with attempts are immutable. Create a new quiz version instead.");
        var questions = await db.Questions.Where(q => q.QuizId == id).ToListAsync(token); var ids = questions.Select(q => q.Id).ToList();
        db.QuestionOptions.RemoveRange(await db.QuestionOptions.Where(o => ids.Contains(o.QuestionId)).ToListAsync(token)); db.Questions.RemoveRange(questions); await db.SaveChangesAsync(token);
        Apply(quiz, r); AddQuestions(id, r.Questions); await db.SaveChangesAsync(token); await completion.RecalculateCourseAsync(quiz.CourseId, token); return await BuildQuizAsync(quiz, true, token);
    }, ct);
    public async Task DeleteAsync(Guid id, CancellationToken ct) => await work.ExecuteAsync(async token =>
    {
        var quiz = await FindAsync(id, token); await access.RequireManageAsync(quiz.CourseId, token); await completion.EnsureCurriculumMutableAsync(quiz.CourseId, token);
        if (await db.QuizAttempts.AnyAsync(a => a.QuizId == id, token)) throw AppException.Conflict("Quizzes with attempt history cannot be deleted.");
        db.Quizzes.Remove(quiz); await db.SaveChangesAsync(token); await completion.RecalculateCourseAsync(quiz.CourseId, token); return true;
    }, ct);
    public async Task<Page<QuizDto>> ListAsync(Guid courseId, PageQuery page, CancellationToken ct)
    {
        await access.RequireReadAsync(courseId, ct); var course = await db.Courses.AsNoTracking().SingleAsync(c => c.Id == courseId, ct); var manager = access.CanManage(course);
        var q = db.Quizzes.AsNoTracking().Where(q => q.CourseId == courseId); if (!manager) q = q.Where(q => q.IsPublished);
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(q => q.Title.Contains(page.Search));
        var count = await q.CountAsync(ct); var quizzes = await q.OrderBy(q => q.Title).ThenBy(q => q.Id).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        var rows = new List<QuizDto>(); foreach (var quiz in quizzes) rows.Add(await BuildQuizAsync(quiz, manager, ct, false));
        return new(rows, page.PageNumber, page.PageSize, count);
    }
    public async Task<QuizDto> GetAsync(Guid id, CancellationToken ct)
    {
        var quiz = await FindAsync(id, ct); var manager = await AuthorizeAsync(quiz, ct); return await BuildQuizAsync(quiz, manager, ct);
    }
    public Task<AttemptDto> StartAsync(Guid quizId, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        RequireStudent(); var quiz = await FindAsync(quizId, token); await AuthorizeAsync(quiz, token);
        if (!quiz.IsPublished) throw AppException.NotFound("Published quiz");
        var questions = await QuestionsAsync(quizId, false, token); if (questions.Count == 0) throw AppException.Conflict("This quiz has no questions.");
        var active = await db.QuizAttempts.SingleOrDefaultAsync(a => a.QuizId == quizId && a.StudentId == user.Id && a.CompletedAt == null, token);
        if (active is not null) { if (!Expire(active)) return BuildAttempt(active, quiz, questions); await db.SaveChangesAsync(token); }
        var maximum = questions.Sum(q => q.Marks);
        var attempt = new QuizAttempt { QuizId = quizId, StudentId = user.Id, StartedAt = clock.GetUtcNow(), ExpiresAt = quiz.TimeLimitMinutes.HasValue ? clock.GetUtcNow().AddMinutes(quiz.TimeLimitMinutes.Value) : null, MaximumMarks = maximum, PassingPercentage = quiz.PassingPercentage };
        db.QuizAttempts.Add(attempt); await db.SaveChangesAsync(token); return BuildAttempt(attempt, quiz, questions);
    }, ct);
    public Task<AttemptDto> AttemptAsync(Guid id, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        var attempt = await FindAttemptAsync(id, token); await OwnAttemptAsync(attempt, token);
        Expire(attempt); return BuildAttempt(attempt, attempt.Quiz, await QuestionsAsync(attempt.QuizId, false, token));
    }, ct);
    public Task<QuizResultDto> SubmitAsync(Guid id, QuizSubmitRequest r, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        var attempt = await FindAttemptAsync(id, token); await OwnAttemptAsync(attempt, token);
        // Retries and duplicate submits return the persisted result without changing answers.
        if (attempt.CompletedAt is not null) return await BuildResultAsync(attempt, token);
        if (Expire(attempt)) { await db.SaveChangesAsync(token); return await BuildResultAsync(attempt, token); }
        var validation = new QuizSubmitValidator().Validate(r); if (!validation.IsValid) throw new FluentValidation.ValidationException(validation.Errors);
        var questions = await QuestionsAsync(attempt.QuizId, true, token); var questionIds = questions.Select(q => q.QuestionId).ToHashSet();
        if (r.Answers.Any(a => !questionIds.Contains(a.QuestionId))) throw new AppException(400, "An answer refers to a question outside this quiz.");
        decimal total = 0;
        foreach (var question in questions)
        {
            var answer = r.Answers.SingleOrDefault(a => a.QuestionId == question.QuestionId); var selected = answer?.SelectedOptionIds.ToList() ?? [];
            if (selected.Any(id => !question.Options.Any(o => o.OptionId == id))) throw new AppException(400, "An option does not belong to its question.");
            if (question.QuestionType == QuestionType.SingleChoice && selected.Count > 1) throw new AppException(400, "Select one answer for a single-choice question.");
            if (question.QuestionType == QuestionType.FreeText && selected.Count > 0) throw new AppException(400, "Text answers cannot contain selected options.");
            if (question.QuestionType != QuestionType.FreeText && !string.IsNullOrEmpty(answer?.Text)) throw new AppException(400, "Choice questions cannot contain a text answer.");
            var correct = question.QuestionType == QuestionType.FreeText
                ? !string.IsNullOrWhiteSpace(answer?.Text) && string.Equals(answer.Text.Trim().Normalize(), question.ExpectedAnswer?.Trim().Normalize(), StringComparison.OrdinalIgnoreCase)
                : selected.Count > 0 && selected.ToHashSet().SetEquals(question.Options.Where(o => o.IsCorrect == true).Select(o => o.OptionId));
            var marks = correct ? question.Marks : 0; total += marks;
            if (selected.Count == 0) db.QuizAnswers.Add(new QuizAnswer { QuizAttemptId = id, QuestionId = question.QuestionId, Text = answer?.Text, AwardedMarks = marks });
            else for (var i = 0; i < selected.Count; i++) db.QuizAnswers.Add(new QuizAnswer { QuizAttemptId = id, QuestionId = question.QuestionId, SelectedOptionId = selected[i], AwardedMarks = i == 0 ? marks : 0 });
        }
        attempt.Score = total; attempt.IsPassed = attempt.MaximumMarks > 0 && total * 100m / attempt.MaximumMarks >= attempt.PassingPercentage; attempt.CompletedAt = clock.GetUtcNow();
        await db.SaveChangesAsync(token); await completion.EvaluateAsync(attempt.Quiz.CourseId, user.Id, token); return await BuildResultAsync(attempt, token);
    }, ct);
    public async Task<QuizResultDto> ResultAsync(Guid id, CancellationToken ct)
    {
        var attempt = await FindAttemptAsync(id, ct); await AuthorizeResultAsync(attempt, ct);
        if (attempt.CompletedAt is null) throw AppException.Conflict("Submit the attempt before viewing its result."); return await BuildResultAsync(attempt, ct);
    }
    public async Task<Page<QuizResultDto>> ResultsAsync(Guid quizId, PageQuery page, CancellationToken ct)
    {
        var quiz = await FindAsync(quizId, ct); var manager = await AuthorizeAsync(quiz, ct);
        var q = db.QuizAttempts.AsNoTracking().Include(a => a.Quiz).Where(a => a.QuizId == quizId); if (!manager) q = q.Where(a => a.StudentId == user.Id);
        var count = await q.CountAsync(ct); var attempts = await q.OrderByDescending(a => a.StartedAt).ThenBy(a => a.Id).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        var rows = new List<QuizResultDto>(); foreach (var attempt in attempts) rows.Add(await BuildResultAsync(attempt, ct));
        return new(rows, page.PageNumber, page.PageSize, count);
    }
    private async Task<bool> AuthorizeAsync(Quiz quiz, CancellationToken ct)
    {
        var course = await db.Courses.AsNoTracking().SingleAsync(c => c.Id == quiz.CourseId, ct); var manager = access.CanManage(course);
        if (!manager) { if (!quiz.IsPublished) throw AppException.NotFound("Quiz"); await access.RequireReadAsync(quiz.CourseId, ct); }
        return manager;
    }
    private async Task OwnAttemptAsync(QuizAttempt attempt, CancellationToken ct)
    { RequireStudent(); if (attempt.StudentId != user.Id) throw AppException.Forbidden(); await access.RequireReadAsync(attempt.Quiz.CourseId, ct); }
    private async Task AuthorizeResultAsync(QuizAttempt attempt, CancellationToken ct)
    { var manager = await AuthorizeAsync(attempt.Quiz, ct); if (!manager && attempt.StudentId != user.Id) throw AppException.Forbidden(); }
    private void RequireStudent() { if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden(); }
    private bool Expire(QuizAttempt attempt)
    {
        if (attempt.CompletedAt is not null || !attempt.ExpiresAt.HasValue || clock.GetUtcNow() < attempt.ExpiresAt.Value) return false;
        attempt.CompletedAt = attempt.ExpiresAt.Value; attempt.Score = 0; attempt.IsPassed = false; attempt.IsExpired = true; return true;
    }
    private async Task<Quiz> FindAsync(Guid id, CancellationToken ct) => await db.Quizzes.SingleOrDefaultAsync(q => q.Id == id, ct) ?? throw AppException.NotFound("Quiz");
    private async Task<QuizAttempt> FindAttemptAsync(Guid id, CancellationToken ct) => await db.QuizAttempts.Include(a => a.Quiz).SingleOrDefaultAsync(a => a.Id == id, ct) ?? throw AppException.NotFound("Quiz attempt");
    private async Task<List<QuestionDto>> QuestionsAsync(Guid id, bool reveal, CancellationToken ct)
    {
        var questions = await db.Questions.AsNoTracking().Where(q => q.QuizId == id).OrderBy(q => q.SequenceNumber).ToListAsync(ct); var ids = questions.Select(q => q.Id).ToList();
        var options = await db.QuestionOptions.AsNoTracking().Where(o => ids.Contains(o.QuestionId)).OrderBy(o => o.Id).ToListAsync(ct);
        return questions.Select(q => new QuestionDto(q.Id, q.Text, q.Type, q.Marks, q.SequenceNumber, options.Where(o => o.QuestionId == q.Id).Select(o => new OptionDto(o.Id, o.Text, reveal ? o.IsCorrect : null)).ToList(), reveal ? q.ExpectedAnswer : null)).ToList();
    }
    private async Task<QuizDto> BuildQuizAsync(Quiz quiz, bool manager, CancellationToken ct, bool includeQuestions = true)
    {
        var questions = await QuestionsAsync(quiz.Id, manager, ct); var canEdit = manager && !await db.QuizAttempts.AnyAsync(a => a.QuizId == quiz.Id, ct);
        return new(quiz.Id, quiz.CourseId, quiz.Title, quiz.Description, quiz.PassingPercentage, quiz.TimeLimitMinutes, quiz.IsPublished, quiz.IsRequired, questions.Count, questions.Sum(q => q.Marks), canEdit, includeQuestions ? questions : []);
    }
    private AttemptDto BuildAttempt(QuizAttempt a, Quiz q, IReadOnlyList<QuestionDto> questions) => new(a.Id, q.Id, q.Title, a.StartedAt, a.ExpiresAt, clock.GetUtcNow(), a.CompletedAt, a.IsExpired, a.Score, a.MaximumMarks, a.IsPassed, questions);
    private async Task<QuizResultDto> BuildResultAsync(QuizAttempt attempt, CancellationToken ct)
    {
        var name = await db.Users.AsNoTracking().Where(u => u.Id == attempt.StudentId).Select(u => u.Name).SingleAsync(ct);
        var reviews = new List<AnswerReviewDto>();
        if (attempt.CompletedAt is not null)
        {
            var questions = await QuestionsAsync(attempt.QuizId, true, ct); var answers = await db.QuizAnswers.AsNoTracking().Where(a => a.QuizAttemptId == attempt.Id).ToListAsync(ct);
            foreach (var q in questions) { var rows = answers.Where(a => a.QuestionId == q.QuestionId).ToList(); reviews.Add(new(q.QuestionId, q.QuestionText, q.QuestionType, q.Marks, rows.Sum(a => a.AwardedMarks ?? 0), rows.Where(a => a.SelectedOptionId.HasValue).Select(a => a.SelectedOptionId!.Value).ToList(), q.Options.Where(o => o.IsCorrect == true).Select(o => o.OptionId).ToList(), rows.FirstOrDefault()?.Text, q.ExpectedAnswer, q.Options)); }
        }
        return new(attempt.Id, attempt.QuizId, attempt.Quiz.CourseId, attempt.StudentId, name, attempt.Quiz.Title, attempt.StartedAt, attempt.CompletedAt, attempt.IsExpired, attempt.Score, attempt.MaximumMarks,
            attempt.MaximumMarks > 0 ? Math.Round((attempt.Score ?? 0) * 100m / attempt.MaximumMarks, 2) : 0, attempt.PassingPercentage, attempt.IsPassed, reviews);
    }
    private void AddQuestions(Guid quizId, IReadOnlyList<QuestionRequest> requests)
    {
        for (var i = 0; i < requests.Count; i++)
        {
            var r = requests[i]; var q = new Question { QuizId = quizId, Text = r.QuestionText, Type = r.QuestionType, Marks = r.Marks, SequenceNumber = i + 1, ExpectedAnswer = r.QuestionType == QuestionType.FreeText ? r.ExpectedAnswer : null }; db.Questions.Add(q);
            foreach (var option in r.Options) db.QuestionOptions.Add(new QuestionOption { QuestionId = q.Id, Text = option.OptionText, IsCorrect = option.IsCorrect });
        }
    }
    private static void Apply(Quiz q, QuizRequest r) { q.Title = r.Title.Trim(); q.Description = r.Description; q.PassingPercentage = r.PassingPercentage; q.TimeLimitMinutes = r.TimeLimitMinutes; q.IsPublished = r.IsPublished; q.IsRequired = r.IsRequired; }
    private static void Validate(QuizRequest r) { var validation = new QuizValidator().Validate(r); if (!validation.IsValid) throw new FluentValidation.ValidationException(validation.Errors); }
}
