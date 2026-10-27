using LMS.Domain;
using Microsoft.EntityFrameworkCore;
namespace LMS.Application;

/// <summary>Enforces assignment ownership, submission deadlines and authorized grading.</summary>
public sealed class AssignmentService(ILmsDbContext db, ICurrentUser user, CourseAccess access, ICompletionService completion, IUnitOfWork unitOfWork, TimeProvider clock)
{
    public Task<AssignmentDto> CreateAsync(Guid courseId, AssignmentRequest r, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        await access.RequireManageAsync(courseId, token); await completion.EnsureCurriculumMutableAsync(courseId, token); Validate(r);
        var assignment = new Assignment { CourseId = courseId }; Apply(assignment, r); db.Assignments.Add(assignment); await db.SaveChangesAsync(token);
        await completion.RecalculateCourseAsync(courseId, token); return DtoMaps.Assignment.Compile()(assignment);
    }, ct);
    public async Task<AssignmentDto> GetAsync(Guid id, CancellationToken ct)
    { var a = await FindAsync(id, ct); await access.RequireReadAsync(a.CourseId, ct); return DtoMaps.Assignment.Compile()(a); }
    public async Task<Page<AssignmentDto>> ListAsync(Guid courseId, PageQuery page, CancellationToken ct)
    {
        await access.RequireReadAsync(courseId, ct); var q = db.Assignments.AsNoTracking().Where(a => a.CourseId == courseId);
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(a => a.Title.Contains(page.Search));
        return await q.OrderBy(a => a.DueDate).ThenBy(a => a.Id).Select(DtoMaps.Assignment).PaginateAsync(page, ct);
    }
    public Task<AssignmentDto> UpdateAsync(Guid id, AssignmentRequest r, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var a = await db.Assignments.SingleOrDefaultAsync(a => a.Id == id, token) ?? throw AppException.NotFound("Assignment"); await access.RequireManageAsync(a.CourseId, token); Validate(r);
        // Existing submissions must retain the marks and passing rules under which they were made.
        var criteriaChanged = a.MaximumMarks != r.MaximumMarks || a.PassingPercentage != r.PassingPercentage || a.IsRequired != r.IsRequired;
        if (criteriaChanged) { await completion.EnsureCurriculumMutableAsync(a.CourseId, token); if (await db.Submissions.AnyAsync(s => s.AssignmentId == id, token)) throw AppException.Conflict("Grading criteria cannot change after submissions exist."); }
        Apply(a, r); await db.SaveChangesAsync(token); await completion.RecalculateCourseAsync(a.CourseId, token); return DtoMaps.Assignment.Compile()(a);
    }, ct);
    public Task<bool> DeleteAsync(Guid id, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var a = await db.Assignments.SingleOrDefaultAsync(a => a.Id == id, token) ?? throw AppException.NotFound("Assignment"); await access.RequireManageAsync(a.CourseId, token); await completion.EnsureCurriculumMutableAsync(a.CourseId, token);
        if (await db.Submissions.AnyAsync(s => s.AssignmentId == id, token)) throw AppException.Conflict("Assignments with submissions cannot be deleted.");
        db.Assignments.Remove(a); await db.SaveChangesAsync(token); await completion.RecalculateCourseAsync(a.CourseId, token); return true;
    }, ct);
    public Task<SubmissionDto> SubmitAsync(Guid assignmentId, SubmitRequest r, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        var a = await FindAsync(assignmentId, token); await access.RequireReadAsync(a.CourseId, token);
        if (a.DueDate < clock.GetUtcNow()) throw AppException.Conflict("The submission deadline has passed.");
        if (await db.Submissions.AnyAsync(s => s.AssignmentId == assignmentId && s.StudentId == user.Id, token)) throw AppException.Conflict("You have already submitted this assignment.");
        var submission = new Submission { AssignmentId = assignmentId, StudentId = user.Id, Content = r.Content, SubmittedAt = clock.GetUtcNow() }; db.Submissions.Add(submission); await db.SaveChangesAsync(token); return DtoMaps.Submission.Compile()(submission);
    }, ct);
    public async Task<Page<SubmissionDto>> ListSubmissionsAsync(Guid id, PageQuery page, CancellationToken ct)
    {
        var a = await FindAsync(id, ct); await access.RequireReadAsync(a.CourseId, ct);
        var course = await db.Courses.AsNoTracking().SingleAsync(c => c.Id == a.CourseId, ct); var q = db.Submissions.AsNoTracking().Where(s => s.AssignmentId == id);
        // Managers can review the class; Students can only read their own answer and feedback.
        if (!access.CanManage(course)) q = q.Where(s => s.StudentId == user.Id);
        return await q.OrderByDescending(s => s.SubmittedAt).ThenBy(s => s.Id).Select(DtoMaps.Submission).PaginateAsync(page, ct);
    }
    public Task<SubmissionDto> GradeAsync(Guid id, GradeRequest r, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var s = await db.Submissions.Include(s => s.Assignment).SingleOrDefaultAsync(s => s.Id == id, token) ?? throw AppException.NotFound("Submission"); await access.RequireManageAsync(s.Assignment.CourseId, token);
        if (r.Marks < 0 || r.Marks > s.Assignment.MaximumMarks) throw new AppException(400, "Marks must be between zero and the assignment maximum.");
        // Once certified, changing marks could contradict the issued completion evidence.
        if (s.Marks != r.Marks && await db.Certificates.AnyAsync(c => c.CourseId == s.Assignment.CourseId && c.StudentId == s.StudentId, token)) throw AppException.Conflict("Marks cannot change after this student's certificate has been issued.");
        s.Marks = r.Marks; s.Feedback = r.Feedback; s.Status = SubmissionStatus.Graded; await db.SaveChangesAsync(token); await completion.EvaluateAsync(s.Assignment.CourseId, s.StudentId, token); return DtoMaps.Submission.Compile()(s);
    }, ct);
    private async Task<Assignment> FindAsync(Guid id, CancellationToken ct) => await db.Assignments.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id, ct) ?? throw AppException.NotFound("Assignment");
    private static void Validate(AssignmentRequest r) { var result = new AssignmentValidator().Validate(r); if (!result.IsValid) throw new FluentValidation.ValidationException(result.Errors); }
    private static void Apply(Assignment a, AssignmentRequest r) { a.Title = r.Title.Trim(); a.Description = r.Description; a.DueDate = r.DueDate; a.MaximumMarks = r.MaximumMarks; a.PassingPercentage = r.PassingPercentage; a.IsRequired = r.IsRequired; }
}
