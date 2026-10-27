using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure;

public sealed class InsightsService(ApplicationDbContext db, ICurrentUser user, CourseAccess access) : IInsightsService
{
    public async Task<IReadOnlyList<string>> CategoriesAsync(CancellationToken ct) => await db.Courses.AsNoTracking().Where(c => c.Status == CourseStatus.Published).Select(c => c.Category).Distinct().OrderBy(c => c).ToListAsync(ct);
    public async Task<CourseOverviewDto> OverviewAsync(Guid id, CancellationToken ct)
    {
        var c = await db.Courses.AsNoTracking().SingleOrDefaultAsync(c => c.Id == id, ct) ?? throw AppException.NotFound("Course");
        if (c.Status != CourseStatus.Published && !access.CanManage(c)) throw AppException.NotFound("Course");
        var trainer = await db.Users.AsNoTracking().Where(u => u.Id == c.TrainerId).Select(u => u.Name).SingleAsync(ct);
        var outline = await db.Lessons.AsNoTracking().Where(l => l.CourseId == id).OrderBy(l => l.SequenceNumber).Select(l => new LessonOutlineDto(l.Id, l.Title, l.SequenceNumber, l.DurationMinutes)).ToListAsync(ct);
        var count = await db.Enrollments.AsNoTracking().CountAsync(e => e.CourseId == id && e.Status != EnrollmentStatus.Cancelled, ct);
        var isEnrolled = user.Id != Guid.Empty && await db.Enrollments.AsNoTracking().AnyAsync(e => e.CourseId == id && e.StudentId == user.Id && e.Status != EnrollmentStatus.Cancelled, ct);
        return new(DtoMaps.Course.Compile()(c), trainer, outline, count, isEnrolled);
    }
    public async Task<CourseProgressDto> ProgressAsync(Guid id, CancellationToken ct)
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        await access.RequireReadAsync(id, ct);
        var lessons = await db.Lessons.AsNoTracking().Where(l => l.CourseId == id).OrderBy(l => l.SequenceNumber).Select(l => new LessonCompletionDto(l.Id, l.Title, l.SequenceNumber, l.DurationMinutes,
            db.LessonProgress.Any(p => p.LessonId == l.Id && p.StudentId == user.Id && p.IsCompleted),
            db.LessonProgress.Where(p => p.LessonId == l.Id && p.StudentId == user.Id).Select(p => p.CompletedAt).FirstOrDefault())).ToListAsync(ct);
        var completed = lessons.Count(l => l.IsCompleted);
        return new(id, lessons.Count, completed, Percent(completed, lessons.Count), lessons);
    }
    public async Task<Page<LearningCourseDto>> LearningAsync(PageQuery page, CancellationToken ct)
    {
        if (!user.IsInRole(Roles.Student)) throw AppException.Forbidden();
        var q = db.Enrollments.AsNoTracking().Where(e => e.StudentId == user.Id && e.Status != EnrollmentStatus.Cancelled);
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(e => e.Course.Title.Contains(page.Search));
        var count = await q.CountAsync(ct);
        var rows = await q.OrderByDescending(e => e.EnrollmentDate).ThenBy(e => e.Id).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).Select(e => new
        {
            e.CourseId,
            e.Course.Title,
            e.Course.Category,
            e.Course.ThumbnailUrl,
            e.EnrollmentDate,
            Total = db.Lessons.Count(l => l.CourseId == e.CourseId),
            Completed = db.LessonProgress.Count(p => p.StudentId == user.Id && p.Lesson.CourseId == e.CourseId && p.IsCompleted),
            NextId = db.Lessons.Where(l => l.CourseId == e.CourseId && !db.LessonProgress.Any(p => p.LessonId == l.Id && p.StudentId == user.Id && p.IsCompleted)).OrderBy(l => l.SequenceNumber).Select(l => (Guid?)l.Id).FirstOrDefault()
        }).ToListAsync(ct);
        return new(rows.Select(r => new LearningCourseDto(r.CourseId, r.Title, r.Category, r.ThumbnailUrl, r.Total, r.Completed, Percent(r.Completed, r.Total), r.NextId, r.EnrollmentDate)).ToList(), page.PageNumber, page.PageSize, count);
    }
    public async Task<Page<StudentProgressDto>> StudentsAsync(Guid id, PageQuery page, CancellationToken ct)
    {
        await access.RequireManageAsync(id, ct);
        var total = await db.Lessons.AsNoTracking().CountAsync(l => l.CourseId == id, ct);
        var q = from e in db.Enrollments.AsNoTracking()
                join u in db.Users.AsNoTracking() on e.StudentId equals u.Id
                where e.CourseId == id && e.Status != EnrollmentStatus.Cancelled
                select new
                {
                    e.StudentId,
                    u.Name,
                    u.Email,
                    e.EnrollmentDate,
                    Completed = db.LessonProgress.Count(p => p.StudentId == u.Id && p.Lesson.CourseId == id && p.IsCompleted)
                };
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(s => s.Name.Contains(page.Search) || (s.Email != null && s.Email.Contains(page.Search)));
        var count = await q.CountAsync(ct);
        var rows = await q.OrderBy(s => s.Name).ThenBy(s => s.StudentId).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        return new(rows.Select(r => new StudentProgressDto(r.StudentId, r.Name, r.Email!, r.EnrollmentDate, r.Completed, total, Percent(r.Completed, total))).ToList(), page.PageNumber, page.PageSize, count);
    }
    public async Task<DashboardDto> DashboardAsync(CancellationToken ct)
    {
        var admin = user.IsInRole(Roles.Admin); var trainer = user.IsInRole(Roles.Trainer);
        var courses = db.Courses.AsNoTracking(); var enrollments = db.Enrollments.AsNoTracking().Where(e => e.Status != EnrollmentStatus.Cancelled);
        var progress = db.LessonProgress.AsNoTracking().Where(p => p.IsCompleted);
        if (trainer) { courses = courses.Where(c => c.TrainerId == user.Id); enrollments = enrollments.Where(e => e.Course.TrainerId == user.Id); progress = progress.Where(p => p.Lesson.Course.TrainerId == user.Id); }
        else if (!admin) { enrollments = enrollments.Where(e => e.StudentId == user.Id); courses = courses.Where(c => enrollments.Any(e => e.CourseId == c.Id)); progress = progress.Where(p => p.StudentId == user.Id); }
        var courseCount = await courses.CountAsync(ct); var enrolled = await enrollments.CountAsync(ct); var completed = await progress.CountAsync(ct);
        var published = await courses.CountAsync(c => c.Status == CourseStatus.Published, ct);
        var totalUsers = 0; var totalTrainers = 0; var totalStudents = 0;
        if (admin)
        {
            totalUsers = await db.Users.CountAsync(ct);
            totalTrainers = await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id where r.Name == Roles.Trainer select ur.UserId).CountAsync(ct);
            totalStudents = await (from ur in db.UserRoles join r in db.Roles on ur.RoleId equals r.Id where r.Name == Roles.Student select ur.UserId).CountAsync(ct);
        }
        else if (trainer) totalStudents = await enrollments.Select(e => e.StudentId).Distinct().CountAsync(ct);
        var recent = await enrollments.OrderByDescending(e => e.EnrollmentDate).ThenBy(e => e.Id).Take(6).Select(e => new ActivityDto("Course enrollment", e.Course.Title, e.EnrollmentDate)).ToListAsync(ct);
        // Monthly enrollment activity is aggregated in SQL within the caller's scope.
        var since = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero).AddMonths(-5);
        var dates = await enrollments.Where(e => e.EnrollmentDate >= since).Select(e => e.EnrollmentDate).ToListAsync(ct);
        var chart = Enumerable.Range(0, 6).Select(i => since.AddMonths(i)).Select(month => new MetricDto(month.ToString("MMM"), dates.Count(d => d.Year == month.Year && d.Month == month.Month))).ToList();
        return new(totalUsers, totalTrainers, totalStudents, courseCount, enrolled, completed, published, chart, recent);
    }
    private static int Percent(int completed, int total) => total == 0 ? 0 : (int)Math.Round(100m * completed / total);
}
