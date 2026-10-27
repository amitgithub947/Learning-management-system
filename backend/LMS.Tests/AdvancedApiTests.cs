using System.Net;
using System.Net.Http.Json;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace LMS.Tests;

public sealed partial class ApiTests
{
    private sealed record LearningFixture(AuthResponse Trainer, AuthResponse Student, AuthResponse Other, CourseDto Course, LessonDto Lesson, AssignmentDto Assignment, QuizDto Quiz);
    private static QuizRequest QuizBody(Guid courseId, bool required = true) => new(courseId, "Knowledge check", "A complete scoring test.", 70, 1, true, required, [
        new("Choose the correct option.",QuestionType.SingleChoice,2,[new("Correct",true),new("Wrong",false)]),
        new("Choose both correct options.",QuestionType.MultipleChoice,3,[new("First",true),new("Second",true),new("Neither",false)]),
        new("Name the language.",QuestionType.FreeText,5,[],"TypeScript")]);
    private async Task<T> PostAsync<T>(string path, object body)
    { var response = await client.PostAsJsonAsync(path, body); Assert.True(response.IsSuccessStatusCode, $"{path}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}"); return (await response.Content.ReadFromJsonAsync<ApiResponse<T>>(Json))!.Data!; }
    private async Task<AuthResponse> LoginAsAsync(AuthResponse account) => await PostAsync<AuthResponse>("/api/auth/login", new LoginRequest(account.User.Email, Password));
    private async Task<LearningFixture> AdvancedFixtureAsync()
    {
        var trainer = await RegisterAsync(); var student = await RegisterAsync(); var other = await RegisterAsync();
        using (var scope = factory.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<IUserService>().SetRoleAsync(trainer.User.UserId, Roles.Trainer, default);
        trainer = await LoginAsAsync(trainer); Bearer(trainer.AccessToken);
        var course = await PostAsync<CourseDto>("/api/courses", new CourseRequest("Complete learning journey", "End-to-end integration course.", "Development", null));
        var lesson = await PostAsync<LessonDto>($"/api/courses/{course.CourseId}/lessons", new LessonRequest("Foundations", "Practical lesson content.", null, 1, 10));
        var assignment = await PostAsync<AssignmentDto>("/api/assignments", new CreateAssignmentRequest(course.CourseId, "Practical exercise", "Explain your reasoning.", DateTimeOffset.UtcNow.AddDays(3), 100, 60, true));
        var quiz = await PostAsync<QuizDto>("/api/quizzes", QuizBody(course.CourseId));
        (await client.PatchAsync($"/api/courses/{course.CourseId}/publish", null)).EnsureSuccessStatusCode();
        Bearer(student.AccessToken); await PostAsync<EnrollmentDto>("/api/enrollments", new EnrollmentRequest(course.CourseId));
        return new(trainer, student, other, course, lesson, assignment, quiz);
    }
    private static QuizSubmitRequest CorrectAnswers(LearningFixture f) => new(f.Quiz.Questions.Select(q => new AnswerRequest(q.QuestionId, q.Options.Where(o => o.IsCorrect == true).Select(o => o.OptionId).ToList(), q.QuestionType == QuestionType.FreeText ? "  typescript  " : null)).ToList());
    private async Task CompleteAsync(LearningFixture f)
    {
        Bearer(f.Student.AccessToken); (await client.PatchAsync($"/api/lessons/{f.Lesson.LessonId}/complete", null)).EnsureSuccessStatusCode();
        var submission = await PostAsync<SubmissionDto>($"/api/assignments/{f.Assignment.AssignmentId}/submit", new SubmitRequest("A thoughtful answer."));
        Bearer(f.Trainer.AccessToken); (await client.PatchAsJsonAsync($"/api/submissions/{submission.SubmissionId}/grade", new GradeRequest(85, "Clear reasoning."))).EnsureSuccessStatusCode();
        Bearer(f.Student.AccessToken); var attempt = await PostAsync<AttemptDto>($"/api/quizzes/{f.Quiz.QuizId}/attempts", new { });
        var result = await PostAsync<QuizResultDto>($"/api/quiz-attempts/{attempt.AttemptId}/submit", CorrectAnswers(f)); Assert.Equal(10, result.Score); Assert.True(result.IsPassed);
    }
    [Fact]
    public async Task CompleteStudentJourneyProducesOneVerifiableProtectedPdfCertificate()
    {
        var f = await AdvancedFixtureAsync();
        // Explicit fresh login is part of the end-to-end registration-to-certificate path.
        var loggedIn = await LoginAsAsync(f.Student); Bearer(loggedIn.AccessToken);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/certificates/course/{f.Course.CourseId}/issue", new { })).StatusCode);
        await CompleteAsync(f);
        var summary = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{f.Course.CourseId}/summary", Json))!.Data!;
        Assert.True(summary.IsEligible); Assert.Equal(EnrollmentStatus.Completed, summary.Status); Assert.Equal(100, summary.Percentage); Assert.Empty(summary.UnmetRequirements);
        var cert = await PostAsync<CertificateDto>($"/api/certificates/course/{f.Course.CourseId}/issue", new { });
        var duplicate = await PostAsync<CertificateDto>($"/api/certificates/course/{f.Course.CourseId}/issue", new { }); Assert.Equal(cert.CertificateId, duplicate.CertificateId);
        var pdf = await client.GetAsync($"/api/certificates/{cert.CertificateId}/download"); pdf.EnsureSuccessStatusCode(); Assert.Equal("application/pdf", pdf.Content.Headers.ContentType!.MediaType); Assert.StartsWith("%PDF", System.Text.Encoding.ASCII.GetString((await pdf.Content.ReadAsByteArrayAsync())[..8]));
        Bearer(f.Other.AccessToken); Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/certificates/{cert.CertificateId}/download")).StatusCode);
        client.DefaultRequestHeaders.Authorization = null; var verified = (await client.GetFromJsonAsync<ApiResponse<CertificateDto>>($"/api/certificates/verify/{cert.VerificationCode}", Json))!.Data!; Assert.Equal(cert.CertificateNumber, verified.CertificateNumber);
        Bearer(f.Trainer.AccessToken); Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/courses/{f.Course.CourseId}/lessons", new LessonRequest("New requirement", "Content", null, 2, 10))).StatusCode);
        var analytics = (await client.GetFromJsonAsync<ApiResponse<AnalyticsDto>>("/api/analytics", Json))!.Data!; Assert.Equal(1, analytics.CompletedStudents); Assert.Equal(100, analytics.QuizPassRate); Assert.Equal(85, analytics.AverageAssignmentPercentage);
    }
    [Fact]
    public async Task QuizAnswersStayPrivateAndDuplicateSubmissionCannotChangeTheScore()
    {
        var f = await AdvancedFixtureAsync(); var quiz = (await client.GetFromJsonAsync<ApiResponse<QuizDto>>($"/api/quizzes/{f.Quiz.QuizId}", Json))!.Data!;
        Assert.All(quiz.Questions, q => { Assert.Null(q.ExpectedAnswer); Assert.All(q.Options, o => Assert.Null(o.IsCorrect)); });
        var attempt = await PostAsync<AttemptDto>($"/api/quizzes/{f.Quiz.QuizId}/attempts", new { }); Assert.All(attempt.Questions, q => Assert.All(q.Options, o => Assert.Null(o.IsCorrect)));
        var resumed = await PostAsync<AttemptDto>($"/api/quizzes/{f.Quiz.QuizId}/attempts", new { }); Assert.Equal(attempt.AttemptId, resumed.AttemptId);
        Assert.Equal(HttpStatusCode.Conflict, (await client.GetAsync($"/api/quiz-attempts/{attempt.AttemptId}/result")).StatusCode);
        var result = await PostAsync<QuizResultDto>($"/api/quiz-attempts/{attempt.AttemptId}/submit", CorrectAnswers(f)); Assert.Equal(10, result.Score);
        var replay = await PostAsync<QuizResultDto>($"/api/quiz-attempts/{attempt.AttemptId}/submit", new QuizSubmitRequest([])); Assert.Equal(10, replay.Score); Assert.InRange((result.SubmittedAt!.Value - replay.SubmittedAt!.Value).Duration(), TimeSpan.Zero, TimeSpan.FromMilliseconds(1));
        Bearer(f.Other.AccessToken); Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/quiz-attempts/{attempt.AttemptId}/result")).StatusCode);
        Bearer(f.Trainer.AccessToken); Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"/api/quizzes/{f.Quiz.QuizId}", QuizBody(f.Course.CourseId))).StatusCode);
    }
    [Fact]
    public async Task ServerDeadlineRejectsLateAnswersEvenIfTheyAreCorrect()
    {
        var f = await AdvancedFixtureAsync(); var attempt = await PostAsync<AttemptDto>($"/api/quizzes/{f.Quiz.QuizId}/attempts", new { });
        factory.Clock.Advance(TimeSpan.FromMinutes(2)); var result = await PostAsync<QuizResultDto>($"/api/quiz-attempts/{attempt.AttemptId}/submit", CorrectAnswers(f));
        Assert.True(result.IsExpired); Assert.False(result.IsPassed); Assert.Equal(0, result.Score); Assert.InRange((attempt.ExpiresAt!.Value - result.SubmittedAt!.Value).Duration(), TimeSpan.Zero, TimeSpan.FromMilliseconds(1));
        var summary = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{f.Course.CourseId}/summary", Json))!.Data!; Assert.False(summary.IsEligible);
    }
    [Fact]
    public async Task AnswerValidationRejectsCrossQuestionOptionsAndDuplicateQuestions()
    {
        var f = await AdvancedFixtureAsync(); var attempt = await PostAsync<AttemptDto>($"/api/quizzes/{f.Quiz.QuizId}/attempts", new { }); var first = f.Quiz.Questions[0]; var other = f.Quiz.Questions[1];
        var invalid = new QuizSubmitRequest([new(first.QuestionId, [other.Options[0].OptionId])]); Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/quiz-attempts/{attempt.AttemptId}/submit", invalid)).StatusCode);
        invalid = new([new(first.QuestionId, []), new(first.QuestionId, [])]); Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync($"/api/quiz-attempts/{attempt.AttemptId}/submit", invalid)).StatusCode);
        var onlyFirst = new QuizSubmitRequest([new(first.QuestionId, first.Options.Where(o => o.IsCorrect == true).Select(o => o.OptionId).ToList())]); var result = await PostAsync<QuizResultDto>($"/api/quiz-attempts/{attempt.AttemptId}/submit", onlyFirst); Assert.Equal(2, result.Score); Assert.False(result.IsPassed);
    }
    [Fact]
    public async Task AssignmentDeadlinesGradingOwnershipAndCriteriaAreEnforced()
    {
        var f = await AdvancedFixtureAsync(); var submission = await PostAsync<SubmissionDto>($"/api/assignments/{f.Assignment.AssignmentId}/submit", new SubmitRequest("Work"));
        Bearer(f.Other.AccessToken); Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync($"/api/submissions/{submission.SubmissionId}/grade", new GradeRequest(100, null))).StatusCode);
        Bearer(f.Trainer.AccessToken); Assert.Equal(HttpStatusCode.BadRequest, (await client.PatchAsJsonAsync($"/api/submissions/{submission.SubmissionId}/grade", new GradeRequest(101, null))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"/api/assignments/{f.Assignment.AssignmentId}", new AssignmentRequest("Updated", "Description", DateTimeOffset.UtcNow.AddDays(2), 200))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/assignments", new CreateAssignmentRequest(f.Course.CourseId, "Past", "Description", DateTimeOffset.UtcNow.AddDays(-1), 100))).StatusCode);
        Bearer(f.Other.AccessToken); await PostAsync<EnrollmentDto>("/api/enrollments", new EnrollmentRequest(f.Course.CourseId)); factory.Clock.Advance(TimeSpan.FromDays(4));
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/assignments/{f.Assignment.AssignmentId}/submit", new SubmitRequest("Too late"))).StatusCode);
    }
    [Fact]
    public async Task LessonCompletionAloneDoesNotSatisfyRequiredAssessments()
    {
        var f = await AdvancedFixtureAsync(); (await client.PatchAsync($"/api/lessons/{f.Lesson.LessonId}/complete", null)).EnsureSuccessStatusCode();
        var p = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{f.Course.CourseId}/summary", Json))!.Data!; Assert.Equal(100, p.Percentage); Assert.False(p.IsEligible); Assert.Equal(EnrollmentStatus.Active, p.Status); Assert.Equal(2, p.UnmetRequirements.Count);
        Bearer(f.Trainer.AccessToken); (await client.PutAsJsonAsync($"/api/courses/{f.Course.CourseId}/completion-settings", new CompletionSettings(true, false, false))).EnsureSuccessStatusCode();
        Bearer(f.Student.AccessToken); p = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{f.Course.CourseId}/summary", Json))!.Data!; Assert.True(p.IsEligible); var completedAt = p.CompletedAt;
        p = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{f.Course.CourseId}/summary", Json))!.Data!; Assert.Equal(completedAt, p.CompletedAt);
    }
    [Fact]
    public async Task EmptyCourseProgressIsZeroAndCannotEarnACertificate()
    {
        var student = await RegisterAsync(); Guid courseId;
        using (var scope = factory.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); var c = new Course { TrainerId = student.User.UserId, Title = "Zero lessons", Category = "Test", Status = CourseStatus.Published }; courseId = c.Id; db.Courses.Add(c); db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = student.User.UserId }); await db.SaveChangesAsync(); }
        Bearer(student.AccessToken); var p = (await client.GetFromJsonAsync<ApiResponse<CompletionDto>>($"/api/progress/courses/{courseId}/summary", Json))!.Data!; Assert.Equal(0, p.Percentage); Assert.False(p.IsEligible); Assert.Equal(0, p.TotalLessons);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync($"/api/certificates/course/{courseId}/issue", new { })).StatusCode);
    }
    [Fact]
    public async Task CertificateIssuanceIsDuplicateSafeUnderSqlConcurrency()
    {
        var f = await AdvancedFixtureAsync(); await CompleteAsync(f);
        var url = $"/api/certificates/course/{f.Course.CourseId}/issue";
        var rows = factory.UsesSqlServer ? await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => PostAsync<CertificateDto>(url, new { }))) : [await PostAsync<CertificateDto>(url, new { }), await PostAsync<CertificateDto>(url, new { })];
        Assert.Single(rows.Select(c => c.CertificateId).Distinct());
        using var scope = factory.Services.CreateScope(); Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Certificates.CountAsync(c => c.CourseId == f.Course.CourseId));
    }
}
