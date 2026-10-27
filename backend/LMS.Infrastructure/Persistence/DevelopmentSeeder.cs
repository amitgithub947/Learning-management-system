using LMS.Domain;
using LMS.Application;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
namespace LMS.Infrastructure.Persistence;

public sealed class DevelopmentSeeder(ApplicationDbContext db, UserManager<Account> users, RoleManager<IdentityRole<Guid>> roles, IConfiguration configuration, ICompletionService completion)
{
    public async Task SeedAsync(CancellationToken ct)
    {
        var password = configuration["Seed:Password"];
        if (string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("Set Seed:Password using user-secrets before enabling development seeding.");
        foreach (var role in Roles.All)
            if (!await roles.RoleExistsAsync(role)) Check(await roles.CreateAsync(new IdentityRole<Guid>(role)));
        var trainerIds = new List<Guid>(); var studentIds = new List<Guid>();
        var definitions = new[] { ("admin", Roles.Admin) }.Concat(Enumerable.Range(1, 2).Select(i => ($"trainer{i}", Roles.Trainer))).Concat(Enumerable.Range(1, 5).Select(i => ($"student{i}", Roles.Student)));
        foreach (var (name, role) in definitions)
        {
            var email = $"{name}@lms.local";
            var account = await users.FindByEmailAsync(email);
            if (account is null)
            {
                account = new Account { Id = Guid.NewGuid(), Name = name, UserName = email, Email = email, EmailConfirmed = true };
                Check(await users.CreateAsync(account, password)); Check(await users.AddToRoleAsync(account, role));
            }
            if (role == Roles.Trainer) trainerIds.Add(account.Id);
            if (role == Roles.Student) studentIds.Add(account.Id);
        }
        if (await db.Courses.AnyAsync(ct)) { await SeedAssessmentsAsync(ct); return; }
        var titles = new[] { "C# Fundamentals", "ASP.NET Core APIs", "SQL Server Essentials", "Clean Architecture", "Angular Integration" };
        for (var i = 0; i < 5; i++)
        {
            var course = new Course { Title = titles[i], Description = $"Practical introduction to {titles[i]}.", Category = i == 2 ? "Database" : "Development", TrainerId = trainerIds[i % 2], Status = i == 4 ? CourseStatus.Draft : CourseStatus.Published };
            for (var j = 1; j <= 3; j++) course.Lessons.Add(new Lesson { CourseId = course.Id, Title = $"Lesson {j}: {titles[i]}", Content = $"Learning objectives and exercises for lesson {j}.", SequenceNumber = j, DurationMinutes = 20 + j * 5 });
            db.Courses.Add(course);
            if (course.Status == CourseStatus.Published) db.Enrollments.Add(new Enrollment { CourseId = course.Id, StudentId = studentIds[i] });
        }
        await db.SaveChangesAsync(ct);
        await SeedAssessmentsAsync(ct);
    }
    private async Task SeedAssessmentsAsync(CancellationToken ct)
    {
        var titles = new[] { "C# Fundamentals", "ASP.NET Core APIs" };
        var courses = await db.Courses.Where(c => titles.Contains(c.Title) && c.Status == CourseStatus.Published).ToListAsync(ct);
        foreach (var course in courses)
        {
            if (await db.Certificates.AnyAsync(c => c.CourseId == course.Id, ct)) continue;
            if (!await db.Assignments.AnyAsync(a => a.CourseId == course.Id, ct)) db.Assignments.Add(new Assignment
            {
                CourseId = course.Id,
                Title = "Apply the fundamentals",
                Description = "Describe a small application you could build with the skills from this course. Explain the data model, one important operation, and how you would validate the inputs.",
                DueDate = DateTimeOffset.UtcNow.AddDays(30),
                MaximumMarks = 100,
                PassingPercentage = 50,
                IsRequired = true
            });
            if (!await db.Quizzes.AnyAsync(q => q.CourseId == course.Id, ct))
            {
                var quiz = new Quiz { CourseId = course.Id, Title = "Foundations knowledge check", Description = "Check your understanding of safe, maintainable application development.", PassingPercentage = 50, TimeLimitMinutes = 10, IsPublished = true, IsRequired = true }; db.Quizzes.Add(quiz);
                var first = new Question { QuizId = quiz.Id, Text = "Where should authorization rules be enforced?", Type = QuestionType.SingleChoice, Marks = 5, SequenceNumber = 1 }; db.Questions.Add(first);
                db.QuestionOptions.AddRange(new QuestionOption { QuestionId = first.Id, Text = "On the backend for every protected request", IsCorrect = true }, new QuestionOption { QuestionId = first.Id, Text = "Only by hiding buttons in the browser", IsCorrect = false });
                var second = new Question { QuizId = quiz.Id, Text = "Which practices help protect data? Select all that apply.", Type = QuestionType.MultipleChoice, Marks = 5, SequenceNumber = 2 }; db.Questions.Add(second);
                db.QuestionOptions.AddRange(new QuestionOption { QuestionId = second.Id, Text = "Validate inputs on the server", IsCorrect = true }, new QuestionOption { QuestionId = second.Id, Text = "Use parameterized database queries", IsCorrect = true }, new QuestionOption { QuestionId = second.Id, Text = "Trust the role sent by a public registration form", IsCorrect = false });
            }
            await db.SaveChangesAsync(ct); await completion.RecalculateCourseAsync(course.Id, ct); await db.SaveChangesAsync(ct);
        }
    }
    private static void Check(IdentityResult r) { if (!r.Succeeded) throw new InvalidOperationException(string.Join("; ", r.Errors.Select(e => e.Description))); }
}
