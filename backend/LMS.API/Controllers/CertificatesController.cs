using LMS.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace LMS.API.Controllers;

[Authorize, Route("api/certificates")]
public sealed class CertificatesController(ICertificateService certificates) : ApiController
{
    [Authorize(Roles = "Student"), HttpGet("my")]
    public async Task<ActionResult<ApiResponse<Page<CertificateDto>>>> Mine([FromQuery] PageQuery q, CancellationToken ct) => Success(await certificates.MineAsync(q, ct));
    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct) { var file = await certificates.DownloadAsync(id, ct); Response.Headers.CacheControl = "no-store"; return File(file.Content, "application/pdf", file.FileName); }
    [AllowAnonymous, EnableRateLimiting("public"), HttpGet("verify/{code}")]
    public async Task<ActionResult<ApiResponse<CertificateDto>>> Verify(string code, CancellationToken ct) => Success(await certificates.VerifyAsync(code, ct));
    [Authorize(Roles = "Student"), HttpPost("course/{courseId:guid}/issue")]
    public async Task<ActionResult<ApiResponse<CertificateDto>>> Issue(Guid courseId, CancellationToken ct) => Success(await certificates.IssueAsync(courseId, ct));
}
