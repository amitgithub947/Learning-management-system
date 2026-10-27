using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize, Route("api/enrollments")]
public sealed class EnrollmentsController(EnrollmentService enrollments) : ApiController
{
    [Authorize(Roles = Roles.Student), HttpPost]
    public async Task<ActionResult<ApiResponse<EnrollmentDto>>> Enroll(EnrollmentRequest r, CancellationToken ct) => Success(await enrollments.EnrollAsync(r.CourseId, ct));
    [Authorize(Roles = Roles.Student), HttpGet("my-courses")]
    public async Task<ActionResult<ApiResponse<Page<EnrollmentDto>>>> Mine([FromQuery] PageQuery q, CancellationToken ct) => Success(await enrollments.MyCoursesAsync(q, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpGet("course/{courseId:guid}")]
    public async Task<ActionResult<ApiResponse<Page<EnrollmentDto>>>> Course(Guid courseId, [FromQuery] PageQuery q, CancellationToken ct) => Success(await enrollments.CourseEnrollmentsAsync(courseId, q, ct));
}
