using System.Net;
using System.Net.Http.Json;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace LMS.Tests;

public sealed partial class ApiTests
{
    private async Task<(Course Course, AuthResponse Trainer, AuthResponse Student, AuthResponse Other)> InsightFixtureAsync()
    {
        var trainer = await RegisterAsync(); var student = await RegisterAsync(); var other = await RegisterAsync();
        Course course;
        using (var scope = factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IUserService>().SetRoleAsync(trainer.User.UserId, Roles.Trainer, default);
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            course = new Course { Title = "Insights course", Description = "Description", TrainerId = trainer.User.UserId, Category = "Development", Status = CourseStatus.Published };
            course.Lessons.Add(new Lesson { CourseId = course.Id, Title = "First", Content = "Protected lesson body", VideoUrl = "https://example.test/private.mp4", SequenceNumber = 1, DurationMinutes = 15 });
            course.Lessons.Add(new Lesson { CourseId = course.Id, Title = "Second", Content = "Protected second body", SequenceNumber = 2, DurationMinutes = 10 });
            db.Courses.Add(course);
            db.Courses.Add(new Course { Title = "Draft insights course", Description = "Draft", TrainerId = trainer.User.UserId, Category = "Secret category" });
            db.Enrollments.AddRange(new Enrollment { CourseId = course.Id, StudentId = student.User.UserId }, new Enrollment { CourseId = course.Id, StudentId = other.User.UserId });
            db.LessonProgress.Add(new LessonProgress { LessonId = course.Lessons.First().Id, StudentId = student.User.UserId, IsCompleted = true, CompletedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(trainer.User.Email, Password)); login.EnsureSuccessStatusCode();
        trainer = (await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!;
        return (course, trainer, student, other);
    }
    [Fact]
    public async Task PublicOverviewExposesOnlyOutlineAndAccurateEnrollmentState()
    {
        var (course, _, student, _) = await InsightFixtureAsync();
        var response = await client.GetAsync($"/api/courses/{course.Id}/overview"); response.EnsureSuccessStatusCode();
        var raw = await response.Content.ReadAsStringAsync(); Assert.DoesNotContain("Protected lesson body", raw); Assert.DoesNotContain("private.mp4", raw);
        var overview = (await response.Content.ReadFromJsonAsync<ApiResponse<CourseOverviewDto>>(Json))!.Data!;
        Assert.Equal(2, overview.Lessons.Count); Assert.False(overview.IsEnrolled); Assert.Equal(2, overview.EnrollmentCount); Assert.False(string.IsNullOrWhiteSpace(overview.TrainerName));
        Bearer(student.AccessToken); overview = (await client.GetFromJsonAsync<ApiResponse<CourseOverviewDto>>($"/api/courses/{course.Id}/overview", Json))!.Data!; Assert.True(overview.IsEnrolled);
        var categories = (await client.GetFromJsonAsync<ApiResponse<string[]>>("/api/courses/categories", Json))!.Data!; Assert.DoesNotContain("Secret category", categories);
    }
    [Fact]
    public async Task ProgressAndDashboardAreScopedToTheAuthenticatedStudent()
    {
        var (course, _, student, other) = await InsightFixtureAsync();
        Bearer(student.AccessToken);
        var progress = (await client.GetFromJsonAsync<ApiResponse<CourseProgressDto>>($"/api/progress/courses/{course.Id}", Json))!.Data!;
        Assert.Equal(50, progress.Percentage); Assert.Equal(1, progress.CompletedLessons); Assert.True(progress.Lessons[0].IsCompleted);
        var learning = (await client.GetFromJsonAsync<ApiResponse<Page<LearningCourseDto>>>("/api/progress/my-courses", Json))!.Data!;
        Assert.Equal(50, learning.Items.Single().Percentage); Assert.Equal(progress.Lessons[1].LessonId, learning.Items.Single().ContinueLessonId);
        var dashboard = (await client.GetFromJsonAsync<ApiResponse<DashboardDto>>("/api/dashboard", Json))!.Data!;
        Assert.Equal(1, dashboard.TotalCourses); Assert.Equal(1, dashboard.TotalEnrollments); Assert.Equal(1, dashboard.CompletedLessons); Assert.Equal(0, dashboard.TotalUsers);
        Bearer(other.AccessToken); progress = (await client.GetFromJsonAsync<ApiResponse<CourseProgressDto>>($"/api/progress/courses/{course.Id}", Json))!.Data!; Assert.Equal(0, progress.CompletedLessons);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/courses/{course.Id}/students")).StatusCode);
    }
    [Fact]
    public async Task TrainerAnalyticsAndStudentProgressRespectOwnership()
    {
        var (course, trainer, _, _) = await InsightFixtureAsync(); Bearer(trainer.AccessToken);
        var students = (await client.GetFromJsonAsync<ApiResponse<Page<StudentProgressDto>>>($"/api/courses/{course.Id}/students", Json))!.Data!;
        Assert.Equal(2, students.TotalCount); Assert.Contains(students.Items, s => s.Percentage == 50); Assert.Contains(students.Items, s => s.Percentage == 0);
        var dashboard = (await client.GetFromJsonAsync<ApiResponse<DashboardDto>>("/api/dashboard", Json))!.Data!;
        Assert.Equal(2, dashboard.TotalCourses); Assert.Equal(2, dashboard.TotalEnrollments); Assert.Equal(2, dashboard.TotalStudents); Assert.Equal(0, dashboard.TotalUsers);
        var outsider = await RegisterAsync(); using (var scope = factory.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<IUserService>().SetRoleAsync(outsider.User.UserId, Roles.Trainer, default);
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(outsider.User.Email, Password)); login.EnsureSuccessStatusCode(); Bearer((await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/courses/{course.Id}/students")).StatusCode);
        dashboard = (await client.GetFromJsonAsync<ApiResponse<DashboardDto>>("/api/dashboard", Json))!.Data!; Assert.Equal(0, dashboard.TotalCourses); Assert.Equal(0, dashboard.TotalEnrollments);
    }
    [Fact]
    public async Task AdminDashboardUserFiltersAndCourseFiltersUseRealRecords()
    {
        var (_, trainer, _, _) = await InsightFixtureAsync();
        using (var scope = factory.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<IUserService>().SetRoleAsync(trainer.User.UserId, Roles.Admin, default);
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(trainer.User.Email, Password)); Bearer((await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!.AccessToken);
        var dashboard = (await client.GetFromJsonAsync<ApiResponse<DashboardDto>>("/api/dashboard", Json))!.Data!; Assert.Equal(3, dashboard.TotalUsers); Assert.Equal(2, dashboard.TotalStudents); Assert.Equal(2, dashboard.TotalCourses); Assert.Equal(2, dashboard.TotalEnrollments);
        var students = (await client.GetFromJsonAsync<ApiResponse<Page<UserDto>>>("/api/users?role=Student&isActive=true", Json))!.Data!; Assert.Equal(2, students.TotalCount); Assert.All(students.Items, u => Assert.Equal(Roles.Student, u.Role));
        var drafts = (await client.GetFromJsonAsync<ApiResponse<Page<CourseDto>>>("/api/courses/my-courses?status=Draft&search=insights", Json))!.Data!; Assert.Single(drafts.Items); Assert.Equal(CourseStatus.Draft, drafts.Items[0].Status);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/courses?sort=unsupported")).StatusCode);
    }
}
