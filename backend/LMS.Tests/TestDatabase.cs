using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace LMS.Tests;
// SQLite is a real relational database for fast offline tests. SQL Server is
// separately verified by applying migrations and running the HTTP smoke script.
public sealed class SqliteTestDb(DbContextOptions<ApplicationDbContext> options) : ApplicationDbContext(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        foreach (var entity in builder.Model.GetEntityTypes())
            foreach (var property in entity.GetProperties())
            {
                if (property.ClrType == typeof(DateTimeOffset) || property.ClrType == typeof(DateTimeOffset?))
                    property.SetValueConverter(new DateTimeOffsetToBinaryConverter());
                if (property.ClrType == typeof(decimal) || property.ClrType == typeof(decimal?))
                    property.SetValueConverter(new ValueConverter<decimal, double>(value => (double)value, value => (decimal)value));
                if (property.Name == "RowVersion") { property.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never; property.IsConcurrencyToken = false; }
            }
    }
}
public sealed class FakeUser(Guid id, params string[] roles) : ICurrentUser
{
    public Guid Id { get; } = id;
    public bool IsInRole(string role) => roles.Contains(role);
}
public abstract class DatabaseTest : IAsyncDisposable
{
    private readonly SqliteConnection connection = new("Data Source=:memory:");
    protected readonly Guid TrainerId = Guid.NewGuid(), OtherTrainerId = Guid.NewGuid(), StudentId = Guid.NewGuid(), OtherStudentId = Guid.NewGuid();
    protected SqliteTestDb Db { get; }
    protected DatabaseTest()
    {
        connection.Open(); Db = new(new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(connection).Options); Db.Database.EnsureCreated();
        foreach (var id in new[] { TrainerId, OtherTrainerId, StudentId, OtherStudentId }) Db.Users.Add(new Account { Id = id, Name = "Test", UserName = id.ToString(), NormalizedUserName = id.ToString().ToUpperInvariant() });
        Db.SaveChanges();
    }
    protected async Task<Course> AddCourseAsync(CourseStatus status = CourseStatus.Published)
    {
        var course = new Course { Title = "Testing", Description = "Test description", Category = "Development", TrainerId = TrainerId, Status = status };
        course.Lessons.Add(new Lesson { CourseId = course.Id, Title = "Lesson", Content = "Private material", SequenceNumber = 1, DurationMinutes = 10 });
        Db.Courses.Add(course); await Db.SaveChangesAsync(); return course;
    }
    protected ICompletionService Completion => new LMS.Infrastructure.CompletionService(Db, TimeProvider.System);
    protected IUnitOfWork Uow => new EfUnitOfWork(Db);
    protected CourseAccess Access(ICurrentUser u) => new(Db, u);
    public async ValueTask DisposeAsync() { await Db.DisposeAsync(); await connection.DisposeAsync(); }
}
