using LMS.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize]
public sealed class QuizzesController(IQuizService quizzes) : ApiController
{
    [Authorize(Roles = "Admin,Trainer"), HttpPost("api/quizzes")]
    public async Task<ActionResult<ApiResponse<QuizDto>>> Create(QuizRequest r, CancellationToken ct) => Success(await quizzes.CreateAsync(r, ct));
    [HttpGet("api/courses/{courseId:guid}/quizzes")]
    public async Task<ActionResult<ApiResponse<Page<QuizDto>>>> List(Guid courseId, [FromQuery] PageQuery q, CancellationToken ct) => Success(await quizzes.ListAsync(courseId, q, ct));
    [HttpGet("api/quizzes/{id:guid}")]
    public async Task<ActionResult<ApiResponse<QuizDto>>> Get(Guid id, CancellationToken ct) => Success(await quizzes.GetAsync(id, ct));
    [Authorize(Roles = "Admin,Trainer"), HttpPut("api/quizzes/{id:guid}")]
    public async Task<ActionResult<ApiResponse<QuizDto>>> Update(Guid id, QuizRequest r, CancellationToken ct) => Success(await quizzes.UpdateAsync(id, r, ct));
    [Authorize(Roles = "Admin,Trainer"), HttpDelete("api/quizzes/{id:guid}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(Guid id, CancellationToken ct) { await quizzes.DeleteAsync(id, ct); return Done("Quiz deleted."); }
    [Authorize(Roles = "Student"), HttpPost("api/quizzes/{id:guid}/attempts")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> Start(Guid id, CancellationToken ct) => Success(await quizzes.StartAsync(id, ct));
    [Authorize(Roles = "Student"), HttpGet("api/quiz-attempts/{id:guid}")]
    public async Task<ActionResult<ApiResponse<AttemptDto>>> Attempt(Guid id, CancellationToken ct) => Success(await quizzes.AttemptAsync(id, ct));
    [Authorize(Roles = "Student"), HttpPost("api/quiz-attempts/{id:guid}/submit")]
    public async Task<ActionResult<ApiResponse<QuizResultDto>>> Submit(Guid id, QuizSubmitRequest r, CancellationToken ct) => Success(await quizzes.SubmitAsync(id, r, ct));
    [HttpGet("api/quiz-attempts/{id:guid}/result")]
    public async Task<ActionResult<ApiResponse<QuizResultDto>>> Result(Guid id, CancellationToken ct) => Success(await quizzes.ResultAsync(id, ct));
    [HttpGet("api/quizzes/{id:guid}/results")]
    public async Task<ActionResult<ApiResponse<Page<QuizResultDto>>>> Results(Guid id, [FromQuery] PageQuery q, CancellationToken ct) => Success(await quizzes.ResultsAsync(id, q, ct));
}
