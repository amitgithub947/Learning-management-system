using System.Security.Claims;
using LMS.Domain;
using Microsoft.EntityFrameworkCore;

namespace LMS.Application;

/// <summary>Application persistence port; the scoped EF context supplies tracked sets and saving.</summary>
public interface ILmsDbContext
{
    DbSet<Course> Courses { get; }
    DbSet<Lesson> Lessons { get; }
    DbSet<Enrollment> Enrollments { get; }
    DbSet<LessonProgress> LessonProgress { get; }
    DbSet<Assignment> Assignments { get; }
    DbSet<Submission> Submissions { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<Question> Questions { get; }
    DbSet<QuestionOption> QuestionOptions { get; }
    DbSet<QuizAttempt> QuizAttempts { get; }
    DbSet<QuizAnswer> QuizAnswers { get; }
    DbSet<Certificate> Certificates { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
/// <summary>Caller identity supplied by the hosting layer, not by API request bodies.</summary>
public interface ICurrentUser
{
    Guid Id { get; }
    bool IsInRole(string role);
}
public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request, CancellationToken ct);
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct);
    Task<AuthResponse> RefreshAsync(TokenRequest request, CancellationToken ct);
    Task LogoutAsync(TokenRequest request, CancellationToken ct);
    Task ChangePasswordAsync(Guid id, ChangePasswordRequest request, CancellationToken ct);
    Task<bool> ValidateSessionAsync(ClaimsPrincipal principal, CancellationToken ct);
}
public interface IUserService
{
    Task<UserDto> GetAsync(Guid id, CancellationToken ct);
    Task<Page<UserDto>> ListAsync(UserQuery query, CancellationToken ct);
    Task SetRoleAsync(Guid id, string role, CancellationToken ct);
    Task SetStatusAsync(Guid id, bool active, CancellationToken ct);
}
public sealed class AppException(int statusCode, string message) : Exception(message)
{
    public int StatusCode { get; } = statusCode;
    public static AppException NotFound(string type) => new(404, $"{type} was not found.");
    public static AppException Forbidden() => new(403, "You do not have permission to perform this action.");
    public static AppException Conflict(string message) => new(409, message);
    public static AppException Unauthorized() => new(401, "Invalid credentials or expired session.");
}
public sealed record ApiResponse<T>(bool Success, T? Data, string? Message = null, IDictionary<string, string[]>? Errors = null, string? TraceId = null);
public sealed record Page<T>(IReadOnlyList<T> Items, int PageNumber, int PageSize, int TotalCount);
public class PageQuery
{
    public int PageNumber { get; set; } = 1;
    public int PageSize { get; set; } = 20;
    public string? Search { get; set; }
}
public sealed class CourseQuery : PageQuery
{
    public string? Category { get; set; }
    public string Sort { get; set; } = "title";
    public CourseStatus? Status { get; set; }
}
public sealed class UserQuery : PageQuery
{
    public string? Role { get; set; }
    public bool? IsActive { get; set; }
}
public sealed record RegisterRequest(string Name, string Email, string Password);
public sealed record LoginRequest(string Email, string Password);
public sealed record TokenRequest(string RefreshToken);
public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);
public sealed record RoleRequest(string Role);
public sealed record StatusRequest(bool IsActive);
public sealed record AuthResponse(string AccessToken, string RefreshToken, DateTimeOffset AccessTokenExpiresAt, UserDto User);
public sealed record UserDto(Guid UserId, string Name, string Email, string Role, DateTimeOffset CreatedAt, bool IsActive);
public sealed record CourseRequest(string Title, string Description, string Category, string? ThumbnailUrl);
public sealed record CourseDto(Guid CourseId, string Title, string Description, Guid TrainerId, string Category, string? ThumbnailUrl, CourseStatus Status, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt);
public sealed record LessonRequest(string Title, string Content, string? VideoUrl, int SequenceNumber, int DurationMinutes, bool IsRequired = true);
public sealed record LessonDto(Guid LessonId, Guid CourseId, string Title, string Content, string? VideoUrl, int SequenceNumber, int DurationMinutes, bool IsRequired = true);
public sealed record EnrollmentRequest(Guid CourseId);
public sealed record EnrollmentDto(Guid EnrollmentId, Guid CourseId, Guid StudentId, string CourseTitle, DateTimeOffset EnrollmentDate, EnrollmentStatus Status, DateTimeOffset? CompletedAt);
public sealed record ProgressDto(Guid LessonId, bool IsCompleted, DateTimeOffset? CompletedAt);
public sealed record AssignmentRequest(string Title, string Description, DateTimeOffset DueDate, decimal MaximumMarks, decimal PassingPercentage = 50, bool IsRequired = true);
public sealed record AssignmentDto(Guid AssignmentId, Guid CourseId, string Title, string Description, DateTimeOffset DueDate, decimal MaximumMarks, decimal PassingPercentage, bool IsRequired, DateTimeOffset CreatedAt);
public sealed record SubmitRequest(string Content);
public sealed record GradeRequest(decimal Marks, string? Feedback);
public sealed record SubmissionDto(Guid SubmissionId, Guid AssignmentId, Guid StudentId, string Content, DateTimeOffset SubmittedAt, decimal? Marks, string? Feedback, SubmissionStatus Status, string? StudentName = null);

public sealed record LessonOutlineDto(Guid LessonId, string Title, int SequenceNumber, int DurationMinutes);
public sealed record CourseOverviewDto(CourseDto Course, string TrainerName, IReadOnlyList<LessonOutlineDto> Lessons, int EnrollmentCount, bool IsEnrolled);
public sealed record LessonCompletionDto(Guid LessonId, string Title, int SequenceNumber, int DurationMinutes, bool IsCompleted, DateTimeOffset? CompletedAt);
public sealed record CourseProgressDto(Guid CourseId, int TotalLessons, int CompletedLessons, int Percentage, IReadOnlyList<LessonCompletionDto> Lessons);
public sealed record LearningCourseDto(Guid CourseId, string Title, string Category, string? ThumbnailUrl, int TotalLessons, int CompletedLessons, int Percentage, Guid? ContinueLessonId, DateTimeOffset EnrolledAt);
public sealed record MetricDto(string Label, int Value);
public sealed record ActivityDto(string Title, string Description, DateTimeOffset OccurredAt);
public sealed record DashboardDto(int TotalUsers, int TotalTrainers, int TotalStudents, int TotalCourses, int TotalEnrollments, int CompletedLessons, int PublishedCourses, IReadOnlyList<MetricDto> Chart, IReadOnlyList<ActivityDto> RecentActivities);
public sealed record StudentProgressDto(Guid StudentId, string Name, string Email, DateTimeOffset EnrollmentDate, int CompletedLessons, int TotalLessons, int Percentage);
public interface IInsightsService
{
    Task<DashboardDto> DashboardAsync(CancellationToken ct);
    Task<CourseOverviewDto> OverviewAsync(Guid courseId, CancellationToken ct);
    Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct);
    Task<CourseProgressDto> ProgressAsync(Guid courseId, CancellationToken ct);
    Task<Page<LearningCourseDto>> LearningAsync(PageQuery query, CancellationToken ct);
    Task<Page<StudentProgressDto>> StudentsAsync(Guid courseId, PageQuery query, CancellationToken ct);
}
