using System.Data;
using LMS.Application;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure.Persistence;

public sealed class EfUnitOfWork(ApplicationDbContext db) : IUnitOfWork
{
    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct)
    {
        var first = true;
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            if (!first) db.ChangeTracker.Clear();
            first = false;
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var result = await action(ct);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return result;
        });
    }
}
