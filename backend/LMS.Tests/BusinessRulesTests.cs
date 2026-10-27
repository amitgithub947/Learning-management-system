using LMS.Application;
using LMS.Domain;
using Microsoft.EntityFrameworkCore;
using Xunit;
namespace LMS.Tests;

public sealed class BusinessRulesTests : DatabaseTest
{
    private static readonly CourseRequest Request = new("Title", "Description", "Development", null);
    [Theory]
    [InlineData(Roles.Student)]
    [InlineData(Roles.Admin)]
    public async Task OnlyTrainersCanCreateCourses(string role)
    {
        var user = new FakeUser(StudentId, role); var service = new CourseService(Db, user, Access(user));
        var error = await Assert.ThrowsAsync<AppException>(() => service.CreateAsync(Request, default)); Assert.Equal(403, error.StatusCode);
    }
    [Fact]
    public async Task TrainerCanCreateDraftCourseWithOwnIdentity()
    {
        var user = new FakeUser(TrainerId, Roles.Trainer); var course = await new CourseService(Db, user, Access(user)).CreateAsync(Request, default);
        Assert.Equal(TrainerId, course.TrainerId); Assert.Equal(CourseStatus.Draft, course.Status);
    }
    [Fact]
    public async Task OtherTrainerCannotModifyCourse()
    {
        var course = await AddCourseAsync(); var user = new FakeUser(OtherTrainerId, Roles.Trainer);
        var error = await Assert.ThrowsAsync<AppException>(() => new CourseService(Db, user, Access(user)).UpdateAsync(course.Id, Request, default)); Assert.Equal(403, error.StatusCode);
    }
    [Fact]
    public async Task AdminCanManageAnotherTrainersCourse()
    {
        var course = await AddCourseAsync(); var user = new FakeUser(OtherTrainerId, Roles.Admin);
        var updated = await new CourseService(Db, user, Access(user)).UpdateAsync(course.Id, Request, default); Assert.Equal("Title", updated.Title);
    }
    [Fact]
    public async Task PublicCatalogExcludesDraftCoursesAndFiltersResults()
    {
        await AddCourseAsync(CourseStatus.Draft); await AddCourseAsync(); var user = new FakeUser(Guid.Empty);
        var page = await new CourseService(Db, user, Access(user)).ListAsync(new() { Category = "Development", Search = "Testing", PageSize = 1 }, default);
        Assert.Equal(1, page.TotalCount); Assert.Single(page.Items); Assert.Equal(CourseStatus.Published, page.Items[0].Status);
    }
    [Fact]
    public async Task DraftMetadataCannotBeReadByAnUnrelatedUser()
    {
        var c = await AddCourseAsync(CourseStatus.Draft); var user = new FakeUser(StudentId, Roles.Student);
        var error = await Assert.ThrowsAsync<AppException>(() => new CourseService(Db, user, Access(user)).GetAsync(c.Id, default)); Assert.Equal(404, error.StatusCode);
    }
    [Fact]
    public async Task CannotEnrollTwice()
    {
        var course = await AddCourseAsync(); var user = new FakeUser(StudentId, Roles.Student); var service = new EnrollmentService(Db, user, Access(user));
        await service.EnrollAsync(course.Id, default);
        var error = await Assert.ThrowsAsync<AppException>(() => service.EnrollAsync(course.Id, default)); Assert.Equal(409, error.StatusCode);
    }
    [Fact]
    public async Task DatabaseAlsoPreventsDuplicateEnrollments()
    {
        var c = await AddCourseAsync(); Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId }); await Db.SaveChangesAsync();
        Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId }); await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }
    [Fact]
    public async Task CannotEnrollInDraftCourse()
    {
        var c = await AddCourseAsync(CourseStatus.Draft); var u = new FakeUser(StudentId, Roles.Student);
        var e = await Assert.ThrowsAsync<AppException>(() => new EnrollmentService(Db, u, Access(u)).EnrollAsync(c.Id, default)); Assert.Equal(404, e.StatusCode);
    }
    [Fact]
    public async Task UnenrolledStudentCannotReadOrCompleteLesson()
    {
        var course = await AddCourseAsync(); var user = new FakeUser(StudentId, Roles.Student); var service = new LessonService(Db, user, Access(user), Completion, Uow);
        var lesson = course.Lessons.Single();
        Assert.Equal(403, (await Assert.ThrowsAsync<AppException>(() => service.GetAsync(lesson.Id, default))).StatusCode);
        Assert.Equal(403, (await Assert.ThrowsAsync<AppException>(() => service.CompleteAsync(lesson.Id, default))).StatusCode);
    }
    [Fact]
    public async Task CompletingLessonIsIdempotentAndUsesCurrentStudent()
    {
        var c = await AddCourseAsync(); Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId }); await Db.SaveChangesAsync();
        var u = new FakeUser(StudentId, Roles.Student); var service = new LessonService(Db, u, Access(u), Completion, Uow);
        var first = await service.CompleteAsync(c.Lessons.Single().Id, default); var second = await service.CompleteAsync(c.Lessons.Single().Id, default);
        var progress = await Db.LessonProgress.SingleAsync(); Assert.Equal(StudentId, progress.StudentId); Assert.True(progress.IsCompleted); Assert.Equal(first.CompletedAt, second.CompletedAt);
    }
    [Fact]
    public async Task DatabaseAlsoPreventsDuplicateLessonProgress()
    {
        var c = await AddCourseAsync(); var id = c.Lessons.Single().Id;
        Db.LessonProgress.Add(new LessonProgress { LessonId = id, StudentId = StudentId }); await Db.SaveChangesAsync();
        Db.LessonProgress.Add(new LessonProgress { LessonId = id, StudentId = StudentId }); await Assert.ThrowsAsync<DbUpdateException>(() => Db.SaveChangesAsync());
    }
    [Fact]
    public async Task CancelledEnrollmentDoesNotGrantLessonAccess()
    {
        var c = await AddCourseAsync(); Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId, Status = EnrollmentStatus.Cancelled }); await Db.SaveChangesAsync();
        var u = new FakeUser(StudentId, Roles.Student); Assert.Equal(403, (await Assert.ThrowsAsync<AppException>(() => Access(u).RequireReadAsync(c.Id, default))).StatusCode);
    }
    [Fact]
    public async Task OnlyOwnerTrainerCanGradeAndMarksMustFitMaximum()
    {
        var c = await AddCourseAsync(); var a = new Assignment { CourseId = c.Id, Title = "Assignment", MaximumMarks = 10, DueDate = DateTimeOffset.UtcNow.AddDays(1) }; Db.Assignments.Add(a);
        Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId });
        var s = new Submission { AssignmentId = a.Id, StudentId = StudentId, Content = "Answer" }; Db.Submissions.Add(s); await Db.SaveChangesAsync();
        var other = new FakeUser(OtherTrainerId, Roles.Trainer);
        Assert.Equal(403, (await Assert.ThrowsAsync<AppException>(() => new AssignmentService(Db, other, Access(other), Completion, Uow, TimeProvider.System).GradeAsync(s.Id, new(5, null), default))).StatusCode);
        var owner = new FakeUser(TrainerId, Roles.Trainer); var service = new AssignmentService(Db, owner, Access(owner), Completion, Uow, TimeProvider.System);
        Assert.Equal(400, (await Assert.ThrowsAsync<AppException>(() => service.GradeAsync(s.Id, new(11, null), default))).StatusCode);
        var graded = await service.GradeAsync(s.Id, new(8, "Well done"), default); Assert.Equal(8, graded.Marks); Assert.Equal(SubmissionStatus.Graded, graded.Status);
    }
    [Fact]
    public async Task TrainerCannotPublishEmptyCourse()
    {
        var u = new FakeUser(TrainerId, Roles.Trainer); var service = new CourseService(Db, u, Access(u)); var c = await service.CreateAsync(Request, default);
        Assert.Equal(409, (await Assert.ThrowsAsync<AppException>(() => service.PublishAsync(c.CourseId, default))).StatusCode);
    }
    [Fact]
    public async Task CourseWithEnrollmentCannotBeDeleted()
    {
        var c = await AddCourseAsync(); Db.Enrollments.Add(new Enrollment { CourseId = c.Id, StudentId = StudentId }); await Db.SaveChangesAsync();
        var u = new FakeUser(TrainerId, Roles.Trainer); Assert.Equal(409, (await Assert.ThrowsAsync<AppException>(() => new CourseService(Db, u, Access(u)).DeleteAsync(c.Id, default))).StatusCode);
    }
    [Theory]
    [InlineData(0, 20)]
    [InlineData(1, 101)]
    public void InvalidPaginationIsRejected(int number, int size) => Assert.False(new PageValidator().Validate(new PageQuery { PageNumber = number, PageSize = size }).IsValid);
    [Theory]
    [InlineData("javascript:alert(1)")]
    [InlineData("file:///etc/passwd")]
    public void UnsafeMediaUrlsAreRejected(string url) => Assert.False(new LessonValidator().Validate(new LessonRequest("Lesson", "Content", url, 1, 10)).IsValid);
}
