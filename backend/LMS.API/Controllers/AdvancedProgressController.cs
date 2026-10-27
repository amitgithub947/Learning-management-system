using LMS.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize]
public sealed class AdvancedProgressController(IAdvancedProgressService progress) : ApiController
{
    [Authorize(Roles = "Student"), HttpGet("api/progress/courses/{courseId:guid}/summary")]
    public async Task<ActionResult<ApiResponse<CompletionDto>>> Summary(Guid courseId, CancellationToken ct) => Success(await progress.SummaryAsync(courseId, ct));
    [Authorize(Roles = "Admin,Trainer"), HttpGet("api/courses/{courseId:guid}/completion-settings")]
    public async Task<ActionResult<ApiResponse<CompletionSettings>>> Settings(Guid courseId, CancellationToken ct) => Success(await progress.SettingsAsync(courseId, ct));
    [Authorize(Roles = "Admin,Trainer"), HttpPut("api/courses/{courseId:guid}/completion-settings")]
    public async Task<ActionResult<ApiResponse<object>>> Save(Guid courseId, CompletionSettings settings, CancellationToken ct) { await progress.SetSettingsAsync(courseId, settings, ct); return Done("Completion requirements updated."); }
    [Authorize(Roles = "Admin,Trainer"), HttpGet("api/analytics")]
    public async Task<ActionResult<ApiResponse<AnalyticsDto>>> Analytics(CancellationToken ct) => Success(await progress.AnalyticsAsync(ct));
}
