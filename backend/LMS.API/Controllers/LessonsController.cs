using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize]
public sealed class LessonsController(LessonService lessons) : ApiController
{
    [HttpGet("api/courses/{courseId:guid}/lessons")]
    public async Task<ActionResult<ApiResponse<Page<LessonDto>>>> List(Guid courseId, [FromQuery] PageQuery q, CancellationToken ct) => Success(await lessons.ListAsync(courseId, q, ct));
    [HttpGet("api/lessons/{id:guid}")]
    public async Task<ActionResult<ApiResponse<LessonDto>>> Get(Guid id, CancellationToken ct) => Success(await lessons.GetAsync(id, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpPost("api/courses/{courseId:guid}/lessons")]
    public async Task<ActionResult<ApiResponse<LessonDto>>> Create(Guid courseId, LessonRequest r, CancellationToken ct) { var dto = await lessons.CreateAsync(courseId, r, ct); return CreatedAtAction(nameof(Get), new { id = dto.LessonId }, new ApiResponse<LessonDto>(true, dto)); }
    [Authorize(Roles = "Trainer,Admin"), HttpPut("api/lessons/{id:guid}")]
    public async Task<ActionResult<ApiResponse<LessonDto>>> Update(Guid id, LessonRequest r, CancellationToken ct) => Success(await lessons.UpdateAsync(id, r, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpDelete("api/lessons/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct) { await lessons.DeleteAsync(id, ct); return Done("Lesson deleted."); }
    [Authorize(Roles = Roles.Student), HttpPatch("api/lessons/{id:guid}/complete")]
    public async Task<ActionResult<ApiResponse<ProgressDto>>> Complete(Guid id, CancellationToken ct) => Success(await lessons.CompleteAsync(id, ct));
}
