using System.Linq.Expressions;
using System.Security.Cryptography;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure;

public sealed class CertificateService(ApplicationDbContext db, ICurrentUser user, ICompletionService completion, IUnitOfWork work, ICertificateRenderer renderer, TimeProvider clock) : ICertificateService
{
    private static readonly Expression<Func<Certificate, CertificateDto>> Map = c => new(c.Id, c.CourseId, c.CourseTitle, c.StudentName, c.TrainerName, c.CompletedAt, c.IssuedAt, c.CertificateNumber, c.VerificationCode);
    public Task<CertificateDto> IssueAsync(Guid courseId, CancellationToken ct) => work.ExecuteAsync(async token =>
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        var existing = await db.Certificates.AsNoTracking().Where(c => c.CourseId == courseId && c.StudentId == user.Id).Select(Map).SingleOrDefaultAsync(token);
        if (existing is not null) return existing;
        var progress = await completion.EvaluateAsync(courseId, user.Id, token);
        if (!progress.IsEligible) throw AppException.Conflict("Complete all course requirements before requesting a certificate.");
        var course = await db.Courses.AsNoTracking().SingleAsync(c => c.Id == courseId, token);
        var names = await db.Users.AsNoTracking().Where(u => u.Id == user.Id || u.Id == course.TrainerId).Select(u => new { u.Id, u.Name }).ToListAsync(token);
        var certificate = new Certificate
        {
            CourseId = courseId,
            StudentId = user.Id,
            CourseTitle = course.Title,
            StudentName = names.Single(u => u.Id == user.Id).Name,
            TrainerName = names.Single(u => u.Id == course.TrainerId).Name,
            CompletedAt = progress.CompletedAt!.Value,
            IssuedAt = clock.GetUtcNow(),
            VerificationCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)),
            CertificateNumber = $"LW-{clock.GetUtcNow():yyyy}-{Convert.ToHexString(RandomNumberGenerator.GetBytes(6))}"
        };
        db.Certificates.Add(certificate); await db.SaveChangesAsync(token); return Map.Compile()(certificate);
    }, ct);
    public Task<Page<CertificateDto>> MineAsync(PageQuery page, CancellationToken ct)
    {
        var q = db.Certificates.AsNoTracking().Where(c => c.StudentId == user.Id);
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(c => c.CourseTitle.Contains(page.Search) || c.CertificateNumber.Contains(page.Search));
        return q.OrderByDescending(c => c.IssuedAt).ThenBy(c => c.Id).Select(Map).PaginateAsync(page, ct);
    }
    public async Task<CertificateDto> VerifyAsync(string code, CancellationToken ct)
    {
        if (code.Length != 32 || !code.All(Uri.IsHexDigit)) throw AppException.NotFound("Certificate");
        var normalized = code.ToUpperInvariant(); return await db.Certificates.AsNoTracking().Where(c => c.VerificationCode == normalized).Select(Map).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("Certificate");
    }
    public async Task<(byte[] Content, string FileName)> DownloadAsync(Guid id, CancellationToken ct)
    {
        var certificate = await db.Certificates.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Certificate");
        if (certificate.StudentId != user.Id && !user.IsInRole(Roles.Admin)) throw AppException.Forbidden();
        return (renderer.Render(Map.Compile()(certificate)), certificate.CertificateNumber + ".pdf");
    }
}
