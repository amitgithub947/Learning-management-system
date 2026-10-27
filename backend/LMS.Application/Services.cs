using System.Linq.Expressions;
using LMS.Domain;
using Microsoft.EntityFrameworkCore;
namespace LMS.Application;

// Expression projections allow EF Core to select DTO fields in SQL instead of loading full entities.
public static class DtoMaps
{
    public static readonly Expression<Func<Course, CourseDto>> Course = c => new(c.Id, c.Title, c.Description, c.TrainerId, c.Category, c.ThumbnailUrl, c.Status, c.CreatedAt, c.UpdatedAt);
    public static readonly Expression<Func<Lesson, LessonDto>> Lesson = l => new(l.Id, l.CourseId, l.Title, l.Content, l.VideoUrl, l.SequenceNumber, l.DurationMinutes, l.IsRequired);
    public static readonly Expression<Func<Enrollment, EnrollmentDto>> Enrollment = e => new(e.Id, e.CourseId, e.StudentId, e.Course.Title, e.EnrollmentDate, e.Status, e.CompletedAt);
    public static readonly Expression<Func<Assignment, AssignmentDto>> Assignment = a => new(a.Id, a.CourseId, a.Title, a.Description, a.DueDate, a.MaximumMarks, a.PassingPercentage, a.IsRequired, a.CreatedAt);
    public static readonly Expression<Func<Submission, SubmissionDto>> Submission = s => new(s.Id, s.AssignmentId, s.StudentId, s.Content, s.SubmittedAt, s.Marks, s.Feedback, s.Status, null);
    public static async Task<Page<T>> PaginateAsync<T>(this IQueryable<T> query, PageQuery page, CancellationToken ct)
    {
        // Bound pagination even when the service is used outside HTTP.
        var validation = new PageValidator().Validate(page);
        if (!validation.IsValid) throw new FluentValidation.ValidationException(validation.Errors);
        var count = await query.CountAsync(ct);
        return new(await query.Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct), page.PageNumber, page.PageSize, count);
    }
}
/// <summary>Centralizes owner/Admin management and enrolled-Student access to course content.</summary>
public sealed class CourseAccess(ILmsDbContext db, ICurrentUser user)
{
    public bool CanManage(Course course) => user.IsInRole(Roles.Admin) || (user.IsInRole(Roles.Trainer) && course.TrainerId == user.Id);
    public async Task<Course> RequireManageAsync(Guid courseId, CancellationToken ct)
    {
        var course = await db.Courses.SingleOrDefaultAsync(x => x.Id == courseId, ct) ?? throw AppException.NotFound("Course");
        if (!CanManage(course)) throw AppException.Forbidden();
        return course;
    }
    public async Task RequireReadAsync(Guid courseId, CancellationToken ct)
    {
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(x => x.Id == courseId, ct) ?? throw AppException.NotFound("Course");
        if (CanManage(course)) return;
        if (course.Status != CourseStatus.Published || !user.IsInRole(Roles.Student) ||
            !await db.Enrollments.AsNoTracking().AnyAsync(e => e.CourseId == courseId && e.StudentId == user.Id && e.Status != EnrollmentStatus.Cancelled, ct))
            throw AppException.Forbidden();
    }
}
/// <summary>Separates the public published catalog from authorized course management.</summary>
public sealed class CourseService(ILmsDbContext db, ICurrentUser user, CourseAccess access)
{
    public Task<Page<CourseDto>> ListAsync(CourseQuery query, CancellationToken ct)
    {
        var courses = db.Courses.AsNoTracking().Where(c => c.Status == CourseStatus.Published);
        if (!string.IsNullOrWhiteSpace(query.Search)) courses = courses.Where(c => c.Title.Contains(query.Search) || c.Description.Contains(query.Search));
        if (!string.IsNullOrWhiteSpace(query.Category)) courses = courses.Where(c => c.Category == query.Category);
        courses = Sort(courses, query.Sort);
        return courses.Select(DtoMaps.Course).PaginateAsync(query, ct);
    }
    public async Task<CourseDto> GetAsync(Guid id, CancellationToken ct)
    {
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Course");
        if (course.Status != CourseStatus.Published && !access.CanManage(course)) throw AppException.NotFound("Course");
        return DtoMaps.Course.Compile()(course);
    }
    public Task<Page<CourseDto>> MyCoursesAsync(CourseQuery query, CancellationToken ct)
    {
        var courses = db.Courses.AsNoTracking();
        if (!user.IsInRole(Roles.Admin)) courses = courses.Where(c => c.TrainerId == user.Id);
        if (!string.IsNullOrWhiteSpace(query.Search)) courses = courses.Where(c => c.Title.Contains(query.Search));
        if (!string.IsNullOrWhiteSpace(query.Category)) courses = courses.Where(c => c.Category == query.Category);
        if (query.Status.HasValue) courses = courses.Where(c => c.Status == query.Status.Value);
        return Sort(courses, query.Sort).Select(DtoMaps.Course).PaginateAsync(query, ct);
    }
    public async Task<CourseDto> CreateAsync(CourseRequest request, CancellationToken ct)
    {
        if (!user.IsInRole(Roles.Trainer)) throw AppException.Forbidden();
        var course = new Course { TrainerId = user.Id };
        Apply(course, request); db.Courses.Add(course); await db.SaveChangesAsync(ct);
        return DtoMaps.Course.Compile()(course);
    }
    public async Task<CourseDto> UpdateAsync(Guid id, CourseRequest request, CancellationToken ct)
    {
        var course = await access.RequireManageAsync(id, ct);
        Apply(course, request); await db.SaveChangesAsync(ct); return DtoMaps.Course.Compile()(course);
    }
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var course = await access.RequireManageAsync(id, ct);
        // Preserve enrollment, submissions, attempts and certificate history.
        if (await db.Enrollments.AsNoTracking().AnyAsync(e => e.CourseId == id, ct))
            throw AppException.Conflict("A course with enrollments cannot be deleted; preserve its learning records.");
        db.Courses.Remove(course); await db.SaveChangesAsync(ct);
    }
    public async Task PublishAsync(Guid id, CancellationToken ct)
    {
        var course = await access.RequireManageAsync(id, ct);
        if (!await db.Lessons.AsNoTracking().AnyAsync(l => l.CourseId == id, ct)) throw AppException.Conflict("Add at least one lesson before publishing.");
        course.Status = CourseStatus.Published; course.UpdatedAt = DateTimeOffset.UtcNow; await db.SaveChangesAsync(ct);
    }
    private static IOrderedQueryable<Course> Sort(IQueryable<Course> q, string sort) => sort switch
    {
        "newest" => q.OrderByDescending(c => c.CreatedAt).ThenBy(c => c.Id),
        "oldest" => q.OrderBy(c => c.CreatedAt).ThenBy(c => c.Id),
        _ => q.OrderBy(c => c.Title).ThenBy(c => c.Id)
    };
    private static void Apply(Course course, CourseRequest request)
    { course.Title = request.Title.Trim(); course.Description = request.Description; course.Category = request.Category.Trim(); course.ThumbnailUrl = request.ThumbnailUrl; course.UpdatedAt = DateTimeOffset.UtcNow; }
}
/// <summary>Manages curriculum and records lesson completion together with enrollment reevaluation.</summary>
public sealed class LessonService(ILmsDbContext db, ICurrentUser user, CourseAccess access, ICompletionService completion, IUnitOfWork unitOfWork)
{
    public async Task<Page<LessonDto>> ListAsync(Guid courseId, PageQuery page, CancellationToken ct)
    {
        await access.RequireReadAsync(courseId, ct);
        return await db.Lessons.AsNoTracking().Where(l => l.CourseId == courseId).OrderBy(l => l.SequenceNumber).Select(DtoMaps.Lesson).PaginateAsync(page, ct);
    }
    public async Task<LessonDto> GetAsync(Guid id, CancellationToken ct)
    {
        var lesson = await FindAsync(id, ct); await access.RequireReadAsync(lesson.CourseId, ct); return DtoMaps.Lesson.Compile()(lesson);
    }
    public Task<LessonDto> CreateAsync(Guid courseId, LessonRequest request, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        await access.RequireManageAsync(courseId, ct);
        await completion.EnsureCurriculumMutableAsync(courseId, ct);
        await EnsureSequenceAsync(courseId, Guid.Empty, request.SequenceNumber, ct);
        var lesson = new Lesson { CourseId = courseId }; Apply(lesson, request); db.Lessons.Add(lesson); await db.SaveChangesAsync(ct); await completion.RecalculateCourseAsync(courseId, ct); await db.SaveChangesAsync(ct); return DtoMaps.Lesson.Compile()(lesson);
    }, ct);
    public Task<LessonDto> UpdateAsync(Guid id, LessonRequest request, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var lesson = await db.Lessons.SingleOrDefaultAsync(l => l.Id == id, ct) ?? throw AppException.NotFound("Lesson");
        await access.RequireManageAsync(lesson.CourseId, ct); await EnsureSequenceAsync(lesson.CourseId, id, request.SequenceNumber, ct);
        if (lesson.IsRequired != request.IsRequired) await completion.EnsureCurriculumMutableAsync(lesson.CourseId, ct);
        Apply(lesson, request); await db.SaveChangesAsync(ct); await completion.RecalculateCourseAsync(lesson.CourseId, ct); await db.SaveChangesAsync(ct); return DtoMaps.Lesson.Compile()(lesson);
    }, ct);
    public Task DeleteAsync(Guid id, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        var lesson = await db.Lessons.SingleOrDefaultAsync(l => l.Id == id, ct) ?? throw AppException.NotFound("Lesson");
        var course = await access.RequireManageAsync(lesson.CourseId, ct);
        if (course.Status == CourseStatus.Published && await db.Lessons.CountAsync(l => l.CourseId == course.Id, ct) <= 1)
            throw AppException.Conflict("A published course must retain at least one lesson.");
        await completion.EnsureCurriculumMutableAsync(lesson.CourseId, ct);
        db.Lessons.Remove(lesson); await db.SaveChangesAsync(ct); await completion.RecalculateCourseAsync(lesson.CourseId, ct); await db.SaveChangesAsync(ct);
        return true;
    }, ct);
    public Task<ProgressDto> CompleteAsync(Guid id, CancellationToken ct) => unitOfWork.ExecuteAsync(async token =>
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        var lesson = await FindAsync(id, token); await access.RequireReadAsync(lesson.CourseId, token);
        var progress = await db.LessonProgress.SingleOrDefaultAsync(p => p.LessonId == id && p.StudentId == user.Id, token);
        if (progress is null) { progress = new LessonProgress { LessonId = id, StudentId = user.Id }; db.LessonProgress.Add(progress); }
        progress.IsCompleted = true; progress.CompletedAt ??= DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(token); await completion.EvaluateAsync(lesson.CourseId, user.Id, token);
        return new ProgressDto(id, progress.IsCompleted, progress.CompletedAt);
    }, ct);
    private async Task<Lesson> FindAsync(Guid id, CancellationToken ct) => await db.Lessons.AsNoTracking().SingleOrDefaultAsync(l => l.Id == id, ct) ?? throw AppException.NotFound("Lesson");
    private async Task EnsureSequenceAsync(Guid courseId, Guid id, int sequence, CancellationToken ct)
    {
        if (await db.Lessons.AsNoTracking().AnyAsync(l => l.CourseId == courseId && l.Id != id && l.SequenceNumber == sequence, ct)) throw AppException.Conflict("Lesson sequence number is already used in this course.");
    }
    private static void Apply(Lesson l, LessonRequest r) { l.Title = r.Title.Trim(); l.Content = r.Content; l.VideoUrl = r.VideoUrl; l.SequenceNumber = r.SequenceNumber; l.DurationMinutes = r.DurationMinutes; l.IsRequired = r.IsRequired; }
}
/// <summary>Enrolls the current Student while preserving uniqueness and course publication rules.</summary>
public sealed class EnrollmentService(ILmsDbContext db, ICurrentUser user, CourseAccess access)
{
    public async Task<EnrollmentDto> EnrollAsync(Guid courseId, CancellationToken ct)
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        var course = await db.Courses.AsNoTracking().SingleOrDefaultAsync(c => c.Id == courseId && c.Status == CourseStatus.Published, ct) ?? throw AppException.NotFound("Published course");
        if (await db.Enrollments.AsNoTracking().AnyAsync(e => e.CourseId == courseId && e.StudentId == user.Id, ct)) throw AppException.Conflict("You are already enrolled in this course.");
        var enrollment = new Enrollment { CourseId = courseId, StudentId = user.Id }; db.Enrollments.Add(enrollment); await db.SaveChangesAsync(ct);
        return new(enrollment.Id, courseId, user.Id, course.Title, enrollment.EnrollmentDate, enrollment.Status, null);
    }
    public Task<Page<EnrollmentDto>> MyCoursesAsync(PageQuery page, CancellationToken ct) => db.Enrollments.AsNoTracking().Where(e => e.StudentId == user.Id).OrderByDescending(e => e.EnrollmentDate).ThenBy(e => e.Id).Select(DtoMaps.Enrollment).PaginateAsync(page, ct);
    public async Task<Page<EnrollmentDto>> CourseEnrollmentsAsync(Guid courseId, PageQuery page, CancellationToken ct)
    {
        await access.RequireManageAsync(courseId, ct);
        return await db.Enrollments.AsNoTracking().Where(e => e.CourseId == courseId).OrderBy(e => e.EnrollmentDate).ThenBy(e => e.Id).Select(DtoMaps.Enrollment).PaginateAsync(page, ct);
    }
}
