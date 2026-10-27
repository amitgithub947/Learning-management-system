using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure;

public sealed class AdvancedProgressService(ApplicationDbContext db, ICurrentUser user, CourseAccess access, ICompletionService completion, IUnitOfWork work) : IAdvancedProgressService
{
    public Task<CompletionDto> SummaryAsync(Guid courseId, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden(); await access.RequireReadAsync(courseId, token); return await completion.EvaluateAsync(courseId, user.Id, token);
    }, ct);
    public async Task<CompletionSettings> SettingsAsync(Guid courseId, CancellationToken ct)
    { var c = await access.RequireManageAsync(courseId, ct); return new(c.RequireLessons, c.RequireAssignments, c.RequireQuizzes); }
    public async Task SetSettingsAsync(Guid courseId, CompletionSettings settings, CancellationToken ct) => await work.ExecuteAsync(async token =>
    {
        var validation = new CompletionSettingsValidator().Validate(settings); if (!validation.IsValid) throw new FluentValidation.ValidationException(validation.Errors);
        var c = await access.RequireManageAsync(courseId, token); await completion.EnsureCurriculumMutableAsync(courseId, token);
        c.RequireLessons = settings.RequireLessons; c.RequireAssignments = settings.RequireAssignments; c.RequireQuizzes = settings.RequireQuizzes; await db.SaveChangesAsync(token); await completion.RecalculateCourseAsync(courseId, token); return true;
    }, ct);
    public async Task<AnalyticsDto> AnalyticsAsync(CancellationToken ct)
    {
        if (!user.IsInRole(Roles.Admin) && !user.IsInRole(Roles.Trainer)) throw AppException.Forbidden(); var admin = user.IsInRole(Roles.Admin);
        var q = db.Courses.AsNoTracking(); if (!admin) q = q.Where(c => c.TrainerId == user.Id); var courses = await q.OrderBy(c => c.Title).ToListAsync(ct); var ids = courses.Select(c => c.Id).ToList();
        var enrollments = await db.Enrollments.AsNoTracking().Where(e => ids.Contains(e.CourseId) && e.Status != EnrollmentStatus.Cancelled).ToListAsync(ct);
        var lessons = await db.Lessons.AsNoTracking().Where(l => ids.Contains(l.CourseId)).Select(l => new { l.Id, l.CourseId }).ToListAsync(ct);
        var progress = await db.LessonProgress.AsNoTracking().Where(p => ids.Contains(p.Lesson.CourseId) && p.IsCompleted).Select(p => new { p.StudentId, p.Lesson.CourseId }).ToListAsync(ct);
        var submissions = await db.Submissions.AsNoTracking().Where(s => ids.Contains(s.Assignment.CourseId) && s.Status == SubmissionStatus.Graded && s.Marks != null).Select(s => new { s.Assignment.CourseId, s.Marks, s.Assignment.MaximumMarks }).ToListAsync(ct);
        var attempts = await db.QuizAttempts.AsNoTracking().Where(a => ids.Contains(a.Quiz.CourseId) && a.CompletedAt != null).Select(a => new { a.Quiz.CourseId, a.IsPassed }).ToListAsync(ct);
        var rows = new List<CourseAnalyticsDto>();
        foreach (var course in courses)
        {
            var students = enrollments.Where(e => e.CourseId == course.Id).ToList(); var count = lessons.Count(l => l.CourseId == course.Id);
            var percentages = students.Select(e => count == 0 ? 0m : 100m * progress.Count(p => p.StudentId == e.StudentId && p.CourseId == course.Id) / count).ToList();
            var grades = submissions.Where(s => s.CourseId == course.Id && s.MaximumMarks > 0).Select(s => s.Marks!.Value * 100m / s.MaximumMarks).ToList(); var quizAttempts = attempts.Where(a => a.CourseId == course.Id).ToList();
            rows.Add(new(course.Id, course.Title, students.Count, students.Count(e => e.Status == EnrollmentStatus.Completed), percentages.Count == 0 ? 0 : Math.Round(percentages.Average(), 2), grades.Count == 0 ? null : Math.Round(grades.Average(), 2), quizAttempts.Count == 0 ? null : Math.Round(100m * quizAttempts.Count(a => a.IsPassed) / quizAttempts.Count, 2)));
        }
        var trainers = new List<TrainerPerformanceDto>();
        if (admin)
        {
            var trainerRows = await (from u in db.Users.AsNoTracking() join ur in db.UserRoles on u.Id equals ur.UserId join r in db.Roles on ur.RoleId equals r.Id where r.Name == Roles.Trainer select new { u.Id, u.Name }).ToListAsync(ct);
            foreach (var t in trainerRows) { var ownIds = courses.Where(c => c.TrainerId == t.Id).Select(c => c.Id).ToHashSet(); var own = enrollments.Where(e => ownIds.Contains(e.CourseId)).ToList(); trainers.Add(new(t.Id, t.Name, ownIds.Count, own.Count, own.Count(e => e.Status == EnrollmentStatus.Completed))); }
        }
        var weighted = rows.Sum(r => r.AverageCompletionPercentage * r.EnrolledStudents); var marks = submissions.Where(s => s.MaximumMarks > 0).Select(s => s.Marks!.Value * 100m / s.MaximumMarks).ToList();
        return new(admin ? await db.Users.CountAsync(ct) : 0, courses.Count, enrollments.Count, enrollments.Count(e => e.Status == EnrollmentStatus.Completed), enrollments.Count == 0 ? 0 : Math.Round(weighted / enrollments.Count, 2), marks.Count == 0 ? null : Math.Round(marks.Average(), 2), attempts.Count == 0 ? null : Math.Round(100m * attempts.Count(a => a.IsPassed) / attempts.Count, 2), rows, trainers);
    }
}
