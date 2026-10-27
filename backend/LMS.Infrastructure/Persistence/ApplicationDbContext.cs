using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace LMS.Infrastructure.Persistence;

public sealed class Account : IdentityUser<Guid>
{
    public string Name { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsActive { get; set; } = true;
}
public sealed class RefreshToken : Entity
{
    public Guid UserId { get; set; }
    public string TokenHash { get; set; } = "";
    public Guid FamilyId { get; set; }
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? RevokedAt { get; set; }
    public string? ReplacedByHash { get; set; }
    public byte[] RowVersion { get; set; } = [];
}
public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<Account, IdentityRole<Guid>, Guid>(options), ILmsDbContext
{
    public DbSet<Course> Courses => Set<Course>();
    public DbSet<Lesson> Lessons => Set<Lesson>();
    public DbSet<Enrollment> Enrollments => Set<Enrollment>();
    public DbSet<Assignment> Assignments => Set<Assignment>();
    public DbSet<Submission> Submissions => Set<Submission>();
    public DbSet<LessonProgress> LessonProgress => Set<LessonProgress>();
    public DbSet<Quiz> Quizzes => Set<Quiz>();
    public DbSet<Question> Questions => Set<Question>();
    public DbSet<QuestionOption> QuestionOptions => Set<QuestionOption>();
    public DbSet<QuizAttempt> QuizAttempts => Set<QuizAttempt>();
    public DbSet<QuizAnswer> QuizAnswers => Set<QuizAnswer>();
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);
        // Roles exist in every environment, independently of development demo data.
        b.Entity<IdentityRole<Guid>>().HasData(
            new IdentityRole<Guid> { Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), Name = LMS.Domain.Roles.Admin, NormalizedName = "ADMIN", ConcurrencyStamp = "lms-admin-role-v1" },
            new IdentityRole<Guid> { Id = Guid.Parse("00000000-0000-0000-0000-000000000002"), Name = LMS.Domain.Roles.Trainer, NormalizedName = "TRAINER", ConcurrencyStamp = "lms-trainer-role-v1" },
            new IdentityRole<Guid> { Id = Guid.Parse("00000000-0000-0000-0000-000000000003"), Name = LMS.Domain.Roles.Student, NormalizedName = "STUDENT", ConcurrencyStamp = "lms-student-role-v1" });
        b.Entity<Account>(e => { e.Property(x => x.Name).HasMaxLength(150); e.HasIndex(x => x.NormalizedEmail).IsUnique().HasFilter("[NormalizedEmail] IS NOT NULL"); });
        b.Entity<Course>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200); e.Property(x => x.Description).HasMaxLength(10000); e.Property(x => x.Category).HasMaxLength(100); e.Property(x => x.ThumbnailUrl).HasMaxLength(2048);
            e.Property(x => x.RowVersion).IsRowVersion(); e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.Status, x.Category }); e.HasOne<Account>().WithMany().HasForeignKey(x => x.TrainerId).OnDelete(DeleteBehavior.Restrict);
        });
        b.Entity<Lesson>(e =>
        {
            e.Property(x => x.Title).HasMaxLength(200); e.Property(x => x.Content).HasMaxLength(100000); e.Property(x => x.VideoUrl).HasMaxLength(2048);
            e.HasOne(x => x.Course).WithMany(x => x.Lessons).HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
            e.HasIndex(x => new { x.CourseId, x.SequenceNumber }).IsUnique();
            e.ToTable(t => { t.HasCheckConstraint("CK_Lesson_Sequence", "[SequenceNumber] > 0"); t.HasCheckConstraint("CK_Lesson_Duration", "[DurationMinutes] >= 0"); });
        });
        b.Entity<Enrollment>(e =>
        {
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.StudentId, x.CourseId }).IsUnique(); e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
        });
        b.Entity<Assignment>(e =>
        {
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Title).HasMaxLength(200); e.Property(x => x.Description).HasMaxLength(10000); e.Property(x => x.MaximumMarks).HasPrecision(10, 2);
            e.ToTable(t => t.HasCheckConstraint("CK_Assignment_Marks", "[MaximumMarks] > 0"));
        });
        b.Entity<Submission>(e =>
        {
            e.HasOne(x => x.Assignment).WithMany().HasForeignKey(x => x.AssignmentId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.StudentId, x.AssignmentId }).IsUnique(); e.Property(x => x.Content).HasMaxLength(100000); e.Property(x => x.Feedback).HasMaxLength(10000);
            e.Property(x => x.Marks).HasPrecision(10, 2); e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.ToTable(t => t.HasCheckConstraint("CK_Submission_Marks", "[Marks] IS NULL OR [Marks] >= 0"));
        });
        b.Entity<LessonProgress>(e =>
        {
            e.HasOne(x => x.Lesson).WithMany().HasForeignKey(x => x.LessonId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.HasIndex(x => new { x.StudentId, x.LessonId }).IsUnique();
        });
        b.Entity<Quiz>(e =>
        {
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Title).HasMaxLength(200); e.Property(x => x.PassingPercentage).HasPrecision(5, 2);
        });
        b.Entity<Question>(e =>
        {
            e.HasOne(x => x.Quiz).WithMany().HasForeignKey(x => x.QuizId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.Text).HasMaxLength(10000); e.Property(x => x.Marks).HasPrecision(10, 2);
            e.HasIndex(x => new { x.QuizId, x.SequenceNumber }).IsUnique();
        });
        b.Entity<QuestionOption>(e => { e.HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Cascade); e.Property(x => x.Text).HasMaxLength(4000); });
        b.Entity<QuizAttempt>(e =>
        {
            e.HasOne(x => x.Quiz).WithMany().HasForeignKey(x => x.QuizId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Score).HasPrecision(10, 2); e.HasIndex(x => new { x.StudentId, x.QuizId });
        });
        b.Entity<QuizAnswer>(e =>
        {
            e.HasOne(x => x.QuizAttempt).WithMany().HasForeignKey(x => x.QuizAttemptId).OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Question).WithMany().HasForeignKey(x => x.QuestionId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.SelectedOption).WithMany().HasForeignKey(x => x.SelectedOptionId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.Text).HasMaxLength(10000); e.Property(x => x.AwardedMarks).HasPrecision(10, 2);
            e.HasIndex(x => new { x.QuizAttemptId, x.QuestionId });
        });
        b.Entity<Certificate>(e =>
        {
            e.HasOne(x => x.Course).WithMany().HasForeignKey(x => x.CourseId).OnDelete(DeleteBehavior.Restrict);
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Restrict);
            e.Property(x => x.CertificateNumber).HasMaxLength(100); e.Property(x => x.FileUrl).HasMaxLength(2048);
            e.HasIndex(x => x.CertificateNumber).IsUnique(); e.HasIndex(x => new { x.StudentId, x.CourseId }).IsUnique();
        });
        b.Entity<Assignment>(e =>
        {
            e.Property(x => x.PassingPercentage).HasPrecision(5, 2);
            e.ToTable(t => t.HasCheckConstraint("CK_Assignment_Passing", "[PassingPercentage] > 0 AND [PassingPercentage] <= 100"));
        });
        b.Entity<Quiz>(e =>
        {
            e.Property(x => x.Description).HasMaxLength(10000);
            e.ToTable(t => { t.HasCheckConstraint("CK_Quiz_Passing", "[PassingPercentage] > 0 AND [PassingPercentage] <= 100"); t.HasCheckConstraint("CK_Quiz_Time", "[TimeLimitMinutes] IS NULL OR ([TimeLimitMinutes] >= 1 AND [TimeLimitMinutes] <= 1440)"); });
        });
        b.Entity<Question>(e => { e.Property(x => x.ExpectedAnswer).HasMaxLength(2000); e.ToTable(t => t.HasCheckConstraint("CK_Question_Marks", "[Marks] > 0")); });
        b.Entity<QuizAttempt>(e =>
        {
            e.Property(x => x.MaximumMarks).HasPrecision(10, 2); e.Property(x => x.PassingPercentage).HasPrecision(5, 2); e.Property(x => x.RowVersion).IsRowVersion();
            e.HasIndex(x => new { x.StudentId, x.QuizId }).IsUnique().HasFilter("[CompletedAt] IS NULL");
        });
        b.Entity<QuizAnswer>().HasIndex(x => new { x.QuizAttemptId, x.QuestionId, x.SelectedOptionId }).IsUnique().HasFilter(null);
        b.Entity<Certificate>(e =>
        {
            e.Property(x => x.VerificationCode).HasMaxLength(32); e.HasIndex(x => x.VerificationCode).IsUnique();
            e.Property(x => x.StudentName).HasMaxLength(150); e.Property(x => x.CourseTitle).HasMaxLength(200); e.Property(x => x.TrainerName).HasMaxLength(150);
        });
        b.Entity<RefreshToken>(e =>
        {
            e.HasOne<Account>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
            e.Property(x => x.TokenHash).HasMaxLength(64); e.Property(x => x.ReplacedByHash).HasMaxLength(64);
            e.Property(x => x.RowVersion).IsRowVersion(); e.HasIndex(x => x.TokenHash).IsUnique(); e.HasIndex(x => x.FamilyId); e.HasIndex(x => x.ExpiresAt);
        });
    }
}
