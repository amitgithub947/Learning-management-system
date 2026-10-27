using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Route("api/courses")]
public sealed class CoursesController(CourseService courses) : ApiController
{
    [AllowAnonymous, HttpGet]
    public async Task<ActionResult<ApiResponse<Page<CourseDto>>>> List([FromQuery] CourseQuery q, CancellationToken ct) => Success(await courses.ListAsync(q, ct));
    [AllowAnonymous, HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CourseDto>>> Get(Guid id, CancellationToken ct) => Success(await courses.GetAsync(id, ct));
    [Authorize(Roles = Roles.Trainer), HttpPost]
    public async Task<ActionResult<ApiResponse<CourseDto>>> Create(CourseRequest r, CancellationToken ct) { var dto = await courses.CreateAsync(r, ct); return CreatedAtAction(nameof(Get), new { id = dto.CourseId }, new ApiResponse<CourseDto>(true, dto)); }
    [Authorize(Roles = "Trainer,Admin"), HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CourseDto>>> Update(Guid id, CourseRequest r, CancellationToken ct) => Success(await courses.UpdateAsync(id, r, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct) { await courses.DeleteAsync(id, ct); return Done("Course deleted."); }
    [Authorize(Roles = "Trainer,Admin"), HttpPatch("{id:guid}/publish")]
    public async Task<ActionResult<ApiResponse<object>>> Publish(Guid id, CancellationToken ct) { await courses.PublishAsync(id, ct); return Done("Course published."); }
    [Authorize(Roles = "Trainer,Admin"), HttpGet("my-courses")]
    public async Task<ActionResult<ApiResponse<Page<CourseDto>>>> Mine([FromQuery] CourseQuery q, CancellationToken ct) => Success(await courses.MyCoursesAsync(q, ct));
}
