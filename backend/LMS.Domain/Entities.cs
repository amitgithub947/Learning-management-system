namespace LMS.Domain;

public static class Roles
{
    public const string Admin = "Admin", Trainer = "Trainer", Student = "Student";
    public static readonly string[] All = [Admin, Trainer, Student];
}
public enum CourseStatus { Draft, Published, Archived }
public enum EnrollmentStatus { Active, Completed, Cancelled }
public enum SubmissionStatus { Submitted, Graded }
public enum QuestionType { SingleChoice, MultipleChoice, FreeText }
public abstract class Entity { public Guid Id { get; set; } = Guid.NewGuid(); }
public sealed class Course : Entity
{
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public Guid TrainerId { get; set; }
    public string Category { get; set; } = "";
    public string? ThumbnailUrl { get; set; }
    public CourseStatus Status { get; set; } = CourseStatus.Draft;
    // Course-level switches select requirement groups; each activity also has its own required flag.
    public bool RequireLessons { get; set; } = true;
    public bool RequireAssignments { get; set; } = true;
    public bool RequireQuizzes { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public byte[] RowVersion { get; set; } = [];
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
}
public sealed class Lesson : Entity
{
    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Content { get; set; } = "";
    public string? VideoUrl { get; set; }
    public int SequenceNumber { get; set; }
    public bool IsRequired { get; set; } = true;
    public int DurationMinutes { get; set; }
}
public sealed class Enrollment : Entity
{
    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public Guid StudentId { get; set; }
    public DateTimeOffset EnrollmentDate { get; set; } = DateTimeOffset.UtcNow;
    public EnrollmentStatus Status { get; set; } = EnrollmentStatus.Active;
    public DateTimeOffset? CompletedAt { get; set; }
}
public sealed class Assignment : Entity
{
    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public DateTimeOffset DueDate { get; set; }
    public decimal MaximumMarks { get; set; }
    public decimal PassingPercentage { get; set; } = 50;
    public bool IsRequired { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Submission : Entity
{
    public Guid AssignmentId { get; set; }
    public Assignment Assignment { get; set; } = null!;
    public Guid StudentId { get; set; }
    public string Content { get; set; } = "";
    public DateTimeOffset SubmittedAt { get; set; } = DateTimeOffset.UtcNow;
    public decimal? Marks { get; set; }
    public string? Feedback { get; set; }
    public SubmissionStatus Status { get; set; }
}
public sealed class LessonProgress : Entity
{
    public Guid LessonId { get; set; }
    public Lesson Lesson { get; set; } = null!;
    public Guid StudentId { get; set; }
    public bool IsCompleted { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}
public sealed class Quiz : Entity
{
    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public string Title { get; set; } = "";
    public decimal PassingPercentage { get; set; }
    public int? TimeLimitMinutes { get; set; }
    public bool IsPublished { get; set; }
    public string Description { get; set; } = "";
    public bool IsRequired { get; set; } = true;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
public sealed class Question : Entity
{
    public Guid QuizId { get; set; }
    public Quiz Quiz { get; set; } = null!;
    public string Text { get; set; } = "";
    public string? ExpectedAnswer { get; set; }
    public QuestionType Type { get; set; }
    public decimal Marks { get; set; }
    public int SequenceNumber { get; set; }
}
public sealed class QuestionOption : Entity
{
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;
    public string Text { get; set; } = "";
    public bool IsCorrect { get; set; }
}
public sealed class QuizAttempt : Entity
{
    public Guid QuizId { get; set; }
    public Quiz Quiz { get; set; } = null!;
    public Guid StudentId { get; set; }
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public decimal? Score { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public decimal MaximumMarks { get; set; }
    public decimal PassingPercentage { get; set; }
    public bool IsPassed { get; set; }
    public bool IsExpired { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
public sealed class QuizAnswer : Entity
{
    public Guid QuizAttemptId { get; set; }
    public QuizAttempt QuizAttempt { get; set; } = null!;
    public Guid QuestionId { get; set; }
    public Question Question { get; set; } = null!;
    // Multiple-choice responses have one row per selection; marks are awarded once per question.
    public Guid? SelectedOptionId { get; set; }
    public QuestionOption? SelectedOption { get; set; }
    public string? Text { get; set; }
    public decimal? AwardedMarks { get; set; }
}
public sealed class Certificate : Entity
{
    public Guid CourseId { get; set; }
    public Course Course { get; set; } = null!;
    public Guid StudentId { get; set; }
    public string CertificateNumber { get; set; } = "";
    public DateTimeOffset IssuedAt { get; set; } = DateTimeOffset.UtcNow;
    public string? FileUrl { get; set; }
    public string VerificationCode { get; set; } = "";
    public string StudentName { get; set; } = "";
    public string CourseTitle { get; set; } = "";
    public string TrainerName { get; set; } = "";
    public DateTimeOffset CompletedAt { get; set; }
}
