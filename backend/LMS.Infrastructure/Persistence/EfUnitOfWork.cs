using System.Data;
using LMS.Application;
using Microsoft.EntityFrameworkCore;
namespace LMS.Infrastructure.Persistence;

/// <summary>Combines serializable isolation with the provider retry strategy for learning mutations.</summary>
public sealed class EfUnitOfWork(ApplicationDbContext db) : IUnitOfWork
{
    public async Task<T> ExecuteAsync<T>(Func<CancellationToken, Task<T>> action, CancellationToken ct)
    {
        var first = true;
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            // A retry must reload state rather than reuse entities from the rolled-back attempt.
            if (!first) db.ChangeTracker.Clear();
            first = false;
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var result = await action(ct);
            // Persist tracked completion/expiry changes even when a callback only returns a DTO.
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return result;
        });
    }
}
