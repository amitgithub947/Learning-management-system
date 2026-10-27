using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using FluentValidation;
using LMS.API;
using LMS.Application;
using LMS.Infrastructure;
using LMS.Infrastructure.Certificates;
using LMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi;
using Serilog;

// Composition root: wire application services to infrastructure implementations for each HTTP request.
var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog((context, services, logger) => logger.ReadFrom.Configuration(context.Configuration).ReadFrom.Services(services).Enrich.FromLogContext().WriteTo.Console());
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, CurrentUser>();
builder.Services.AddScoped<CourseAccess>(); builder.Services.AddScoped<CourseService>(); builder.Services.AddScoped<LessonService>(); builder.Services.AddScoped<EnrollmentService>(); builder.Services.AddScoped<AssignmentService>();
builder.Services.AddScoped<DevelopmentSeeder>();
builder.Services.AddScoped<IInsightsService, InsightsService>();
// Inject the clock so expiry and completion rules can use deterministic time in tests.
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IUnitOfWork, EfUnitOfWork>();
builder.Services.AddScoped<ICompletionService, CompletionService>();
builder.Services.AddScoped<IQuizService, QuizService>();
builder.Services.AddScoped<ICertificateService, CertificateService>();
builder.Services.AddSingleton<ICertificateRenderer, CertificateRenderer>();
builder.Services.AddScoped<IAdvancedProgressService, AdvancedProgressService>();
builder.Services.AddValidatorsFromAssemblyContaining<RegisterValidator>();
builder.Services.AddControllers(o => o.Filters.Add<ValidationFilter>()).AddJsonOptions(o => o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.Configure<ApiBehaviorOptions>(o => o.InvalidModelStateResponseFactory = context => new BadRequestObjectResult(new ApiResponse<object>(false, null, "Validation failed.", context.ModelState.Where(x => x.Value?.Errors.Count > 0).ToDictionary(x => x.Key, x => x.Value!.Errors.Select(e => string.IsNullOrWhiteSpace(e.ErrorMessage) ? "Invalid value." : e.ErrorMessage).ToArray()), context.HttpContext.TraceIdentifier)));
builder.Services.AddExceptionHandler<GlobalExceptionHandler>(); builder.Services.AddProblemDetails();
// Endpoints require authentication unless explicitly marked AllowAnonymous.
builder.Services.AddAuthorization(o => o.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
builder.Services.AddCors(o => o.AddPolicy("Angular", policy => policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = 429;
    o.OnRejected = async (context, ct) => { context.HttpContext.Response.Headers.RetryAfter = "60"; await context.HttpContext.Response.WriteAsJsonAsync(new ApiResponse<object>(false, null, "Too many requests. Try again later.", TraceId: context.HttpContext.TraceIdentifier), ct); };
    o.AddPolicy("public", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 60, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(context.Connection.RemoteIpAddress?.ToString() ?? "unknown", _ => new FixedWindowRateLimiterOptions { PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o =>
{
    o.SwaggerDoc("v1", new OpenApiInfo { Title = "LMS API", Version = "v1", Description = "Complete LMS: identity, courses, lessons, assignments, quizzes, completion, certificates and analytics." });
    o.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme { Type = SecuritySchemeType.Http, Scheme = "bearer", BearerFormat = "JWT", Description = "Enter the access token returned by login." });
    o.AddSecurityRequirement(document => new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("Bearer", document)] = [] });
});
var app = builder.Build();
// Wrap exception handling so request logs record the final, translated HTTP status.
app.UseSerilogRequestLogging();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment() && !app.Environment.IsEnvironment("Testing")) { app.UseHsts(); app.UseHttpsRedirection(); }
app.UseStatusCodePages(async context => { var response = context.HttpContext.Response; await response.WriteAsJsonAsync(new ApiResponse<object>(false, null, $"Request failed ({response.StatusCode}).", TraceId: context.HttpContext.TraceIdentifier)); });
if (app.Environment.IsDevelopment() || app.Environment.IsEnvironment("Testing")) { app.UseSwagger(); app.UseSwaggerUI(); }
// Authenticate claims before evaluating role policies; CORS also applies to rejected requests.
app.UseCors("Angular"); app.UseRateLimiter(); app.UseAuthentication(); app.UseAuthorization();
app.MapControllers();
// Liveness only: this endpoint does not query SQL Server.
app.MapGet("/health", () => Results.Ok(new ApiResponse<object>(true, new { status = "healthy" }))).AllowAnonymous();
// Production migrations and administrator provisioning remain deployment responsibilities.
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Database:MigrateOnStartup"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.MigrateAsync();
}
if (app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Seed:Enabled"))
{
    await using var scope = app.Services.CreateAsyncScope();
    await scope.ServiceProvider.GetRequiredService<DevelopmentSeeder>().SeedAsync(CancellationToken.None);
}
await app.RunAsync();
public partial class Program;
