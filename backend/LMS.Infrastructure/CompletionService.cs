using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure;

/// <summary>Derives eligibility from persisted lessons, grades and attempts, never client percentages.</summary>
public sealed class CompletionService(ApplicationDbContext db, TimeProvider clock) : ICompletionService
{
    public async Task EnsureCurriculumMutableAsync(Guid courseId, CancellationToken ct)
    {
        // Freeze curriculum requirements once a certificate relies on them.
        if (await db.Certificates.AsNoTracking().AnyAsync(c => c.CourseId == courseId, ct))
            throw AppException.Conflict("Completion requirements are locked after the first certificate is issued. Create a new course version to change the curriculum.");
    }
    public async Task RecalculateCourseAsync(Guid courseId, CancellationToken ct)
    {
        var ids = await db.Enrollments.AsNoTracking().Where(e => e.CourseId == courseId && e.Status != EnrollmentStatus.Cancelled).Select(e => e.StudentId).ToListAsync(ct);
        foreach (var id in ids) await EvaluateAsync(courseId, id, ct);
    }
    public async Task<CompletionDto> EvaluateAsync(Guid courseId, Guid studentId, CancellationToken ct)
    {
        var enrollment = await db.Enrollments.Include(e => e.Course).SingleOrDefaultAsync(e => e.CourseId == courseId && e.StudentId == studentId, ct);
        if (enrollment is null || enrollment.Status == EnrollmentStatus.Cancelled) throw AppException.Forbidden();
        var course = enrollment.Course;
        var lessons = await db.Lessons.AsNoTracking().Where(l => l.CourseId == courseId).Select(l => new { l.Id, l.IsRequired }).ToListAsync(ct);
        var completed = await db.LessonProgress.AsNoTracking().Where(p => p.StudentId == studentId && p.Lesson.CourseId == courseId && p.IsCompleted).Select(p => p.LessonId).ToListAsync(ct);
        var assignments = await db.Assignments.AsNoTracking().Where(a => a.CourseId == courseId).OrderBy(a => a.DueDate).ThenBy(a => a.Id).ToListAsync(ct);
        var submissions = await db.Submissions.AsNoTracking().Where(s => s.StudentId == studentId && s.Assignment.CourseId == courseId).ToListAsync(ct);
        var assignmentRows = assignments.Select(a =>
        {
            var submission = submissions.SingleOrDefault(s => s.AssignmentId == a.Id);
            return new AssignmentPerformanceDto(a.Id, a.Title, a.IsRequired, a.MaximumMarks, a.PassingPercentage, submission?.Id, submission?.Status, submission?.Marks, submission?.Feedback,
                submission?.Status == SubmissionStatus.Graded && submission.Marks.HasValue && a.MaximumMarks > 0 && submission.Marks.Value * 100m / a.MaximumMarks >= a.PassingPercentage);
        }).ToList();
        var quizzes = await db.Quizzes.AsNoTracking().Where(q => q.CourseId == courseId).OrderBy(q => q.CreatedAt).ThenBy(q => q.Id).ToListAsync(ct);
        var attempts = await db.QuizAttempts.AsNoTracking().Where(a => a.StudentId == studentId && a.Quiz.CourseId == courseId && a.CompletedAt != null).ToListAsync(ct);
        var quizRows = quizzes.Select(q =>
        {
            var rows = attempts.Where(a => a.QuizId == q.Id).ToList(); return new QuizPerformanceDto(q.Id, q.Title, q.IsRequired, q.PassingPercentage, rows.Count,
            rows.Count == 0 ? null : rows.Max(a => a.MaximumMarks > 0 ? (a.Score ?? 0) * 100m / a.MaximumMarks : 0), rows.Any(a => a.IsPassed));
        }).ToList();
        var unmet = new List<string>();
        var requiredLessons = lessons.Where(l => l.IsRequired).ToList();
        var doneRequired = requiredLessons.Count(l => completed.Contains(l.Id));
        var activities = (course.RequireLessons ? requiredLessons.Count : 0) + (course.RequireAssignments ? assignmentRows.Count(a => a.IsRequired) : 0) + (course.RequireQuizzes ? quizRows.Count(q => q.IsRequired) : 0);
        // An empty course must not qualify through vacuous "all requirements passed" checks.
        if (activities == 0) unmet.Add("The course needs at least one required learning activity.");
        if (course.Status != CourseStatus.Published) unmet.Add("The course must be published.");
        if (course.RequireLessons && doneRequired < requiredLessons.Count) unmet.Add($"Complete {requiredLessons.Count - doneRequired} required lesson(s).");
        if (course.RequireAssignments) foreach (var a in assignmentRows.Where(a => a.IsRequired && !a.IsPassed)) unmet.Add($"Pass assignment: {a.Title} ({a.PassingPercentage}% required).");
        if (course.RequireQuizzes) foreach (var q in quizRows.Where(q => q.IsRequired && !q.IsPassed)) unmet.Add($"Pass quiz: {q.Title} ({q.PassingPercentage}% required).");
        var eligible = unmet.Count == 0;
        // Preserve the first completion timestamp on repeated evaluations; reopen unmet enrollments.
        if (eligible) { enrollment.Status = EnrollmentStatus.Completed; enrollment.CompletedAt ??= clock.GetUtcNow(); }
        else if (enrollment.Status == EnrollmentStatus.Completed) { enrollment.Status = EnrollmentStatus.Active; enrollment.CompletedAt = null; }
        var certificateId = await db.Certificates.AsNoTracking().Where(c => c.CourseId == courseId && c.StudentId == studentId).Select(c => (Guid?)c.Id).SingleOrDefaultAsync(ct);
        // Lesson progress is a display metric distinct from assessment-based eligibility, with zero-safe division.
        return new(courseId, course.Title, lessons.Count, completed.Count, Math.Max(0, lessons.Count - completed.Count), lessons.Count == 0 ? 0 : (int)Math.Round(100m * completed.Count / lessons.Count),
            enrollment.Status, enrollment.CompletedAt, eligible, new(course.RequireLessons, course.RequireAssignments, course.RequireQuizzes), requiredLessons.Count, doneRequired, assignmentRows, quizRows, unmet, certificateId);
    }
}
