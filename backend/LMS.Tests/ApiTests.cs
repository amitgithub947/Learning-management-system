using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;
namespace LMS.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    private readonly string? sqlConnection = Environment.GetEnvironmentVariable("LMS_TEST_SQL_CONNECTION") is { Length: > 0 } configured
        ? new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(configured) { InitialCatalog = $"LMS_Tests_{Guid.NewGuid():N}" }.ConnectionString : null;
    public TestClock Clock { get; } = new();
    public bool UsesSqlServer => sqlConnection is not null;
    private bool databaseCreated;
    public ApiFactory() { connection.Open(); }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Jwt:SigningKey"] = "integration-tests-only-key-of-at-least-32-bytes-0123456789",
            ["ConnectionStrings:DefaultConnection"] = "unused",
            ["AllowedHosts"] = "*"
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<TimeProvider>(); services.AddSingleton<TimeProvider>(Clock);
            services.RemoveAll<ApplicationDbContext>(); services.RemoveAll<DbContextOptions<ApplicationDbContext>>(); services.RemoveAll<IDbContextOptionsConfiguration<ApplicationDbContext>>();
            if (sqlConnection is null)
                services.AddScoped<ApplicationDbContext>(_ => new SqliteTestDb(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options));
            else
                services.AddDbContext<ApplicationDbContext>(o => o.UseSqlServer(sqlConnection, sql => sql.EnableRetryOnFailure()));
        });
    }
    public async Task InitializeAsync()
    {
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); if (sqlConnection is null) await db.Database.EnsureCreatedAsync(); else await db.Database.MigrateAsync();
        databaseCreated = true;
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        foreach (var role in Roles.All) if (!await roleManager.RoleExistsAsync(role)) await roleManager.CreateAsync(new IdentityRole<Guid>(role));
    }
    protected override void Dispose(bool disposing)
    {
        if (disposing && databaseCreated && sqlConnection is not null)
        {
            databaseCreated = false;
            using var scope = Services.CreateScope();
            scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureDeleted();
        }
        base.Dispose(disposing); if (disposing) connection.Dispose();
    }
}
public sealed partial class ApiTests : IAsyncLifetime
{
    private readonly ApiFactory factory = new();
    private HttpClient client = null!;
    private const string Password = "Tests!Password123";
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() } };
    public async Task InitializeAsync() { client = factory.CreateClient(); await factory.InitializeAsync(); }
    public Task DisposeAsync() { client.Dispose(); factory.Dispose(); return Task.CompletedTask; }
    private async Task<AuthResponse> RegisterAsync()
    {
        var response = await client.PostAsJsonAsync("/api/auth/register", new { name = "Test Student", email = $"{Guid.NewGuid():N}@example.com", password = Password, role = "Admin" });
        response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!;
    }
    private void Bearer(string token) => client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    [Fact]
    public async Task RegistrationCannotEscalateRoleAndUserManagementIsAdminOnly()
    {
        var auth = await RegisterAsync(); Assert.Equal(Roles.Student, auth.User.Role); Bearer(auth.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/users")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/courses", new CourseRequest("Test", "Description", "Dev", null))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }
    [Fact]
    public async Task RefreshRotatesTokenAndReplayRevokesEntireFamily()
    {
        var auth = await RegisterAsync();
        var response = await client.PostAsJsonAsync("/api/auth/refresh", new TokenRequest(auth.RefreshToken)); response.EnsureSuccessStatusCode();
        var rotated = (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!; Assert.NotEqual(auth.RefreshToken, rotated.RefreshToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/refresh", new TokenRequest(auth.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/refresh", new TokenRequest(rotated.RefreshToken))).StatusCode);
        Bearer(rotated.AccessToken); Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }
    [Fact]
    public async Task LogoutImmediatelyRevokesAccessAndRefreshTokens()
    {
        var auth = await RegisterAsync(); Bearer(auth.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/logout", new TokenRequest(auth.RefreshToken))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/refresh", new TokenRequest(auth.RefreshToken))).StatusCode);
    }
    [Fact]
    public async Task PasswordChangeInvalidatesSessionsAndOldPassword()
    {
        var auth = await RegisterAsync(); Bearer(auth.AccessToken);
        (await client.PostAsJsonAsync("/api/auth/change-password", new ChangePasswordRequest(Password, "New!Password12345"))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(auth.User.Email, Password))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(auth.User.Email, "New!Password12345"))).StatusCode);
    }
    [Fact]
    public async Task DisabledAccountLosesAccessAndCannotLogIn()
    {
        var auth = await RegisterAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>(); var account = await db.Users.SingleAsync(u => u.Id == auth.User.UserId); account.IsActive = false; await db.SaveChangesAsync();
        }
        Bearer(auth.AccessToken); Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(auth.User.Email, Password))).StatusCode);
    }
    [Fact]
    public async Task ValidationAndUnauthorizedResponsesUseStandardEnvelope()
    {
        var invalid = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest("", "bad", "short")); Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var body = await invalid.Content.ReadFromJsonAsync<JsonElement>(Json); Assert.False(body.GetProperty("success").GetBoolean()); Assert.True(body.GetProperty("errors").TryGetProperty("Email", out _));
        var unauthorized = await client.GetAsync("/api/users"); Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.False((await unauthorized.Content.ReadFromJsonAsync<JsonElement>(Json)).GetProperty("success").GetBoolean());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/courses?pageSize=101")).StatusCode);
    }
    [Fact]
    public async Task OpenApiAndHealthAreAvailable()
    {
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        var response = await client.GetAsync("/swagger/v1/swagger.json"); response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadFromJsonAsync<JsonElement>(Json); Assert.True(json.GetProperty("paths").TryGetProperty("/api/auth/register", out _));
    }
    [Fact]
    public async Task OnlyAdminCanAssignRolesAndRoleChangesInvalidateSessions()
    {
        var admin = await RegisterAsync(); var student = await RegisterAsync();
        using (var scope = factory.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<IUserService>().SetRoleAsync(admin.User.UserId, Roles.Admin, default);
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(admin.User.Email, Password)); login.EnsureSuccessStatusCode();
        Bearer((await login.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!.AccessToken);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PatchAsJsonAsync($"/api/users/{admin.User.UserId}/role", new RoleRequest(Roles.Student))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PatchAsJsonAsync($"/api/users/{admin.User.UserId}/status", new StatusRequest(false))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PatchAsJsonAsync($"/api/users/{student.User.UserId}/role", new RoleRequest(Roles.Trainer))).StatusCode);
        Bearer(student.AccessToken); Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        var trainer = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(student.User.Email, Password)); trainer.EnsureSuccessStatusCode();
        var auth = (await trainer.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!; Assert.Equal(Roles.Trainer, auth.User.Role);
        Bearer(auth.AccessToken); Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/courses", new CourseRequest("Trainer course", "Description", "Dev", null))).StatusCode);
    }
    [Fact]
    public async Task AuthenticationIsRateLimited()
    {
        HttpResponseMessage? last = null;
        for (var i = 0; i < 31; i++) { last?.Dispose(); last = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("missing@example.com", Password)); }
        using (last) Assert.Equal(HttpStatusCode.TooManyRequests, last!.StatusCode);
    }

    [Fact]
    public async Task FullLearningWorkflowEnforcesOwnershipEnrollmentAndGrading()
    {
        var trainer = await RegisterAsync(); var other = await RegisterAsync(); var student = await RegisterAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<IUserService>();
            await users.SetRoleAsync(trainer.User.UserId, Roles.Trainer, default);
            await users.SetRoleAsync(other.User.UserId, Roles.Trainer, default);
        }
        async Task<string> LoginToken(string email)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, Password)); response.EnsureSuccessStatusCode();
            return (await response.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>(Json))!.Data!.AccessToken;
        }
        var ownerToken = await LoginToken(trainer.User.Email); var otherToken = await LoginToken(other.User.Email);
        Bearer(ownerToken);
        var created = await client.PostAsJsonAsync("/api/courses", new CourseRequest("Integration course", "Description", "Development", null)); created.EnsureSuccessStatusCode();
        var course = (await created.Content.ReadFromJsonAsync<ApiResponse<CourseDto>>(Json))!.Data!;
        var lessonResponse = await client.PostAsJsonAsync($"/api/courses/{course.CourseId}/lessons", new LessonRequest("Lesson", "Protected content", null, 1, 10)); lessonResponse.EnsureSuccessStatusCode();
        var lesson = (await lessonResponse.Content.ReadFromJsonAsync<ApiResponse<LessonDto>>(Json))!.Data!;
        Bearer(otherToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"/api/courses/{course.CourseId}", new CourseRequest("Hacked", "Description", "Development", null))).StatusCode);
        Bearer(student.AccessToken);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/courses/{course.CourseId}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/lessons/{lesson.LessonId}")).StatusCode);
        Bearer(ownerToken); (await client.PatchAsync($"/api/courses/{course.CourseId}/publish", null)).EnsureSuccessStatusCode();
        Bearer(student.AccessToken);
        (await client.PostAsJsonAsync("/api/enrollments", new EnrollmentRequest(course.CourseId))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/enrollments", new EnrollmentRequest(course.CourseId))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/lessons/{lesson.LessonId}")).StatusCode);
        (await client.PatchAsync($"/api/lessons/{lesson.LessonId}/complete", null)).EnsureSuccessStatusCode();
        (await client.PatchAsync($"/api/lessons/{lesson.LessonId}/complete", null)).EnsureSuccessStatusCode();
        var enrollments = await client.GetFromJsonAsync<ApiResponse<Page<EnrollmentDto>>>("/api/enrollments/my-courses", Json); Assert.Equal(student.User.UserId, enrollments!.Data!.Items.Single().StudentId);
        Bearer(ownerToken);
        var assignmentResponse = await client.PostAsJsonAsync($"/api/courses/{course.CourseId}/assignments", new AssignmentRequest("Assignment", "Description", DateTimeOffset.UtcNow.AddDays(1), 10)); assignmentResponse.EnsureSuccessStatusCode();
        var assignment = (await assignmentResponse.Content.ReadFromJsonAsync<ApiResponse<AssignmentDto>>(Json))!.Data!;
        Bearer(student.AccessToken);
        var submitted = await client.PostAsJsonAsync($"/api/assignments/{assignment.AssignmentId}/submissions", new SubmitRequest("My answer")); submitted.EnsureSuccessStatusCode();
        var submission = (await submitted.Content.ReadFromJsonAsync<ApiResponse<SubmissionDto>>(Json))!.Data!;
        Bearer(otherToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PatchAsJsonAsync($"/api/submissions/{submission.SubmissionId}/grade", new GradeRequest(8, "Feedback"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/enrollments/course/{course.CourseId}")).StatusCode);
        Bearer(ownerToken); (await client.PatchAsJsonAsync($"/api/submissions/{submission.SubmissionId}/grade", new GradeRequest(8, "Feedback"))).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/courses/{course.CourseId}")).StatusCode);
    }

}
