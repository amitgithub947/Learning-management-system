using LMS.Domain;
namespace LMS.Application;

public interface IUnitOfWork
{
    Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct);
}
public sealed record CreateAssignmentRequest(Guid CourseId, string Title, string Description, DateTimeOffset DueDate, decimal MaximumMarks, decimal PassingPercentage = 50, bool IsRequired = true);
public sealed record CompletionSettings(bool RequireLessons, bool RequireAssignments, bool RequireQuizzes);
public sealed record AssignmentPerformanceDto(Guid AssignmentId, string Title, bool IsRequired, decimal MaximumMarks, decimal PassingPercentage, Guid? SubmissionId, SubmissionStatus? Status, decimal? Marks, string? Feedback, bool IsPassed);
public sealed record QuizPerformanceDto(Guid QuizId, string Title, bool IsRequired, decimal PassingPercentage, int Attempts, decimal? BestPercentage, bool IsPassed);
public sealed record CompletionDto(Guid CourseId, string CourseTitle, int TotalLessons, int CompletedLessons, int RemainingLessons, int Percentage, EnrollmentStatus Status, DateTimeOffset? CompletedAt, bool IsEligible, CompletionSettings Settings, int RequiredLessons, int RequiredLessonsCompleted, IReadOnlyList<AssignmentPerformanceDto> Assignments, IReadOnlyList<QuizPerformanceDto> Quizzes, IReadOnlyList<string> UnmetRequirements, Guid? CertificateId);
public interface ICompletionService
{
    Task<CompletionDto> EvaluateAsync(Guid courseId, Guid studentId, CancellationToken ct);
    Task RecalculateCourseAsync(Guid courseId, CancellationToken ct);
    Task EnsureCurriculumMutableAsync(Guid courseId, CancellationToken ct);
}
public sealed record OptionRequest(string OptionText, bool IsCorrect);
public sealed record QuestionRequest(string QuestionText, QuestionType QuestionType, decimal Marks, IReadOnlyList<OptionRequest> Options, string? ExpectedAnswer = null);
public sealed record QuizRequest(Guid CourseId, string Title, string Description, decimal PassingPercentage, int? TimeLimitMinutes, bool IsPublished, bool IsRequired, IReadOnlyList<QuestionRequest> Questions);
public sealed record OptionDto(Guid OptionId, string OptionText, bool? IsCorrect);
public sealed record QuestionDto(Guid QuestionId, string QuestionText, QuestionType QuestionType, decimal Marks, int SequenceNumber, IReadOnlyList<OptionDto> Options, string? ExpectedAnswer);
public sealed record QuizDto(Guid QuizId, Guid CourseId, string Title, string Description, decimal PassingPercentage, int? TimeLimitMinutes, bool IsPublished, bool IsRequired, int QuestionCount, decimal MaximumMarks, bool CanEdit, IReadOnlyList<QuestionDto> Questions);
public sealed record AnswerRequest(Guid QuestionId, IReadOnlyList<Guid> SelectedOptionIds, string? Text = null);
public sealed record QuizSubmitRequest(IReadOnlyList<AnswerRequest> Answers);
public sealed record AttemptDto(Guid AttemptId, Guid QuizId, string QuizTitle, DateTimeOffset StartedAt, DateTimeOffset? ExpiresAt, DateTimeOffset ServerTime, DateTimeOffset? SubmittedAt, bool IsExpired, decimal? Score, decimal MaximumMarks, bool IsPassed, IReadOnlyList<QuestionDto> Questions);
public sealed record AnswerReviewDto(Guid QuestionId, string QuestionText, QuestionType QuestionType, decimal MaximumMarks, decimal AwardedMarks, IReadOnlyList<Guid> SelectedOptionIds, IReadOnlyList<Guid> CorrectOptionIds, string? Text, string? ExpectedAnswer, IReadOnlyList<OptionDto> Options);
public sealed record QuizResultDto(Guid AttemptId, Guid QuizId, Guid CourseId, Guid StudentId, string StudentName, string QuizTitle, DateTimeOffset StartedAt, DateTimeOffset? SubmittedAt, bool IsExpired, decimal? Score, decimal MaximumMarks, decimal Percentage, decimal PassingPercentage, bool IsPassed, IReadOnlyList<AnswerReviewDto> Answers);
public interface IQuizService
{
    Task<QuizDto> CreateAsync(QuizRequest request, CancellationToken ct);
    Task<QuizDto> UpdateAsync(Guid id, QuizRequest request, CancellationToken ct);
    Task DeleteAsync(Guid id, CancellationToken ct);
    Task<Page<QuizDto>> ListAsync(Guid courseId, PageQuery page, CancellationToken ct);
    Task<QuizDto> GetAsync(Guid id, CancellationToken ct);
    Task<AttemptDto> StartAsync(Guid quizId, CancellationToken ct);
    Task<AttemptDto> AttemptAsync(Guid id, CancellationToken ct);
    Task<QuizResultDto> SubmitAsync(Guid id, QuizSubmitRequest request, CancellationToken ct);
    Task<QuizResultDto> ResultAsync(Guid id, CancellationToken ct);
    Task<Page<QuizResultDto>> ResultsAsync(Guid quizId, PageQuery page, CancellationToken ct);
}
public sealed record CertificateDto(Guid CertificateId, Guid CourseId, string CourseTitle, string StudentName, string TrainerName, DateTimeOffset CompletedAt, DateTimeOffset IssuedAt, string CertificateNumber, string VerificationCode);
public interface ICertificateService
{
    Task<CertificateDto> IssueAsync(Guid courseId, CancellationToken ct);
    Task<Page<CertificateDto>> MineAsync(PageQuery page, CancellationToken ct);
    Task<CertificateDto> VerifyAsync(string code, CancellationToken ct);
    Task<(byte[] Content, string FileName)> DownloadAsync(Guid id, CancellationToken ct);
}
public interface ICertificateRenderer { byte[] Render(CertificateDto certificate); }
public sealed record CourseAnalyticsDto(Guid CourseId, string Title, int EnrolledStudents, int CompletedStudents, decimal AverageCompletionPercentage, decimal? AverageAssignmentPercentage, decimal? QuizPassRate);
public sealed record TrainerPerformanceDto(Guid TrainerId, string Name, int Courses, int Enrollments, int CompletedStudents);
public sealed record AnalyticsDto(int TotalUsers, int TotalCourses, int TotalEnrollments, int CompletedStudents, decimal AverageCompletionPercentage, decimal? AverageAssignmentPercentage, decimal? QuizPassRate, IReadOnlyList<CourseAnalyticsDto> Courses, IReadOnlyList<TrainerPerformanceDto> Trainers);
public interface IAdvancedProgressService
{
    Task<CompletionDto> SummaryAsync(Guid courseId, CancellationToken ct);
    Task<CompletionSettings> SettingsAsync(Guid courseId, CancellationToken ct);
    Task SetSettingsAsync(Guid courseId, CompletionSettings settings, CancellationToken ct);
    Task<AnalyticsDto> AnalyticsAsync(CancellationToken ct);
}
