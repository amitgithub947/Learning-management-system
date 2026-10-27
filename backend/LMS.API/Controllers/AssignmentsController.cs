using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize]
public sealed class AssignmentsController(AssignmentService assignments, IUserService users) : ApiController
{
    [Authorize(Roles = "Trainer,Admin"), HttpPost("api/courses/{courseId:guid}/assignments")]
    public async Task<ActionResult<ApiResponse<AssignmentDto>>> Create(Guid courseId, AssignmentRequest r, CancellationToken ct) => Success(await assignments.CreateAsync(courseId, r, ct));
    [HttpGet("api/courses/{courseId:guid}/assignments")]
    public async Task<ActionResult<ApiResponse<Page<AssignmentDto>>>> List(Guid courseId, [FromQuery] PageQuery q, CancellationToken ct) => Success(await assignments.ListAsync(courseId, q, ct));
    [Authorize(Roles = Roles.Student), HttpPost("api/assignments/{id:guid}/submissions"), HttpPost("api/assignments/{id:guid}/submit")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> Submit(Guid id, SubmitRequest r, CancellationToken ct) => Success(await assignments.SubmitAsync(id, r, ct));
    [HttpGet("api/assignments/{id:guid}/submissions")]
    public async Task<ActionResult<ApiResponse<Page<SubmissionDto>>>> Submissions(Guid id, [FromQuery] PageQuery q, CancellationToken ct)
    {
        var page = await assignments.ListSubmissionsAsync(id, q, ct); var rows = new List<SubmissionDto>();
        foreach (var submission in page.Items) { var student = await users.GetAsync(submission.StudentId, ct); rows.Add(submission with { StudentName = student.Name }); }
        return Success(page with { Items = rows });
    }
    [Authorize(Roles = "Trainer,Admin"), HttpPatch("api/submissions/{id:guid}/grade")]
    public async Task<ActionResult<ApiResponse<SubmissionDto>>> Grade(Guid id, GradeRequest r, CancellationToken ct) => Success(await assignments.GradeAsync(id, r, ct));

    [Authorize(Roles = "Trainer,Admin"), HttpPost("api/assignments")]
    public async Task<ActionResult<ApiResponse<AssignmentDto>>> CreateAdvanced(CreateAssignmentRequest r, CancellationToken ct) => Success(await assignments.CreateAsync(r.CourseId, new(r.Title, r.Description, r.DueDate, r.MaximumMarks, r.PassingPercentage, r.IsRequired), ct));
    [HttpGet("api/assignments/{id:guid}")]
    public async Task<ActionResult<ApiResponse<AssignmentDto>>> Get(Guid id, CancellationToken ct) => Success(await assignments.GetAsync(id, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpPut("api/assignments/{id:guid}")]
    public async Task<ActionResult<ApiResponse<AssignmentDto>>> Update(Guid id, AssignmentRequest r, CancellationToken ct) => Success(await assignments.UpdateAsync(id, r, ct));
    [Authorize(Roles = "Trainer,Admin"), HttpDelete("api/assignments/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct) { await assignments.DeleteAsync(id, ct); return Done("Assignment deleted."); }
}
