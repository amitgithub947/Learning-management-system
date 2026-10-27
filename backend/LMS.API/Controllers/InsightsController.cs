using LMS.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize]
public sealed class InsightsController(IInsightsService insights) : ApiController
{
    [HttpGet("api/dashboard")]
    public async Task<ActionResult<ApiResponse<DashboardDto>>> Dashboard(CancellationToken ct) => Success(await insights.DashboardAsync(ct));
    [AllowAnonymous, HttpGet("api/courses/categories")]
    public async Task<ActionResult<ApiResponse<IReadOnlyList<string>>>> Categories(CancellationToken ct) => Success(await insights.CategoriesAsync(ct));
    [AllowAnonymous, HttpGet("api/courses/{courseId:guid}/overview")]
    public async Task<ActionResult<ApiResponse<CourseOverviewDto>>> Overview(Guid courseId, CancellationToken ct) => Success(await insights.OverviewAsync(courseId, ct));
    [Authorize(Roles = "Student"), HttpGet("api/progress/courses/{courseId:guid}")]
    public async Task<ActionResult<ApiResponse<CourseProgressDto>>> Progress(Guid courseId, CancellationToken ct) => Success(await insights.ProgressAsync(courseId, ct));
    [Authorize(Roles = "Student"), HttpGet("api/progress/my-courses")]
    public async Task<ActionResult<ApiResponse<Page<LearningCourseDto>>>> Learning([FromQuery] PageQuery q, CancellationToken ct) => Success(await insights.LearningAsync(q, ct));
    [Authorize(Roles = "Admin,Trainer"), HttpGet("api/courses/{courseId:guid}/students")]
    public async Task<ActionResult<ApiResponse<Page<StudentProgressDto>>>> Students(Guid courseId, [FromQuery] PageQuery q, CancellationToken ct) => Success(await insights.StudentsAsync(courseId, q, ct));
}
