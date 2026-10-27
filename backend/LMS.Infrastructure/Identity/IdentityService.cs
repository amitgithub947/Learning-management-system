using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using LMS.Application;
using LMS.Domain;
using LMS.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LMS.Infrastructure.Identity;

/// <summary>Coordinates Identity accounts, JWT issuance and persisted refresh-token sessions.</summary>
public sealed class IdentityService(ApplicationDbContext db, UserManager<Account> users, SignInManager<Account> signIn, IOptions<JwtOptions> options) : IAuthService, IUserService
{
    private readonly JwtOptions jwt = options.Value;
    public async Task<AuthResponse> RegisterAsync(RegisterRequest r, CancellationToken ct)
    {
        var account = new Account { Id = Guid.NewGuid(), Name = r.Name.Trim(), Email = r.Email.Trim(), UserName = r.Email.Trim() };
        return await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            Check(await users.CreateAsync(account, r.Password));
            // Public registration cannot grant Trainer or Admin permissions.
            Check(await users.AddToRoleAsync(account, Roles.Student));
            var response = await IssueAsync(account, Guid.NewGuid(), ct);
            await tx.CommitAsync(ct); return response;
        });
    }
    public async Task<AuthResponse> LoginAsync(LoginRequest r, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var account = await users.FindByEmailAsync(r.Email.Trim());
        if (account is null || !account.IsActive) throw AppException.Unauthorized();
        var result = await signIn.CheckPasswordSignInAsync(account, r.Password, lockoutOnFailure: true);
        if (!result.Succeeded) throw AppException.Unauthorized();
        return await IssueAsync(account, Guid.NewGuid(), ct);
    }
    public async Task<AuthResponse> RefreshAsync(TokenRequest r, CancellationToken ct)
    {
        var hash = Hash(r.RefreshToken);
        // Serializable + rowversion: two consumers cannot rotate the same token.
        // Reuse revocation must commit before rejecting the request.
        var result = await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var token = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
            if (token is null) return (AuthResponse?)null;
            if (token.RevokedAt is not null)
            {
                await RevokeFamilyAsync(token.FamilyId, ct);
                await tx.CommitAsync(ct); return null;
            }
            var account = await users.FindByIdAsync(token.UserId.ToString());
            if (token.ExpiresAt <= DateTimeOffset.UtcNow || account is null || !account.IsActive || await users.IsLockedOutAsync(account)) return null;
            token.RevokedAt = DateTimeOffset.UtcNow;
            var response = await IssueAsync(account, token.FamilyId, ct);
            token.ReplacedByHash = Hash(response.RefreshToken);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return response;
        });
        return result ?? throw AppException.Unauthorized();
    }
    public async Task LogoutAsync(TokenRequest r, CancellationToken ct)
    {
        var token = await db.RefreshTokens.AsNoTracking().SingleOrDefaultAsync(t => t.TokenHash == Hash(r.RefreshToken), ct);
        if (token is not null) await RevokeFamilyAsync(token.FamilyId, ct);
    }
    public async Task ChangePasswordAsync(Guid id, ChangePasswordRequest r, CancellationToken ct)
    {
        var account = await FindAsync(id);
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            Check(await users.ChangePasswordAsync(account, r.CurrentPassword, r.NewPassword));
            await RevokeUserTokensAsync(id, ct); await tx.CommitAsync(ct);
        });
    }
    public async Task<bool> ValidateSessionAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        if (!Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id) || !Guid.TryParse(principal.FindFirstValue("sid"), out var family)) return false;
        var account = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, ct);
        // Stamp checks immediately invalidate access after password, role, status changes.
        if (account is null || !account.IsActive || account.SecurityStamp != principal.FindFirstValue("security_stamp") || (account.LockoutEnd is not null && account.LockoutEnd > DateTimeOffset.UtcNow)) return false;
        var now = DateTimeOffset.UtcNow;
        return await db.RefreshTokens.AsNoTracking().AnyAsync(t => t.FamilyId == family && t.UserId == id && t.RevokedAt == null && t.ExpiresAt > now, ct);
    }
    public async Task<UserDto> GetAsync(Guid id, CancellationToken ct) { ct.ThrowIfCancellationRequested(); return await ToDtoAsync(await FindAsync(id)); }
    public async Task<Page<UserDto>> ListAsync(UserQuery page, CancellationToken ct)
    {
        var q = db.Users.AsNoTracking();
        if (page.IsActive.HasValue) q = q.Where(u => u.IsActive == page.IsActive.Value);
        if (!string.IsNullOrWhiteSpace(page.Role))
        {
            var roleIds = db.Roles.Where(r => r.Name == page.Role).Select(r => r.Id);
            q = q.Where(u => db.UserRoles.Any(ur => ur.UserId == u.Id && roleIds.Contains(ur.RoleId)));
        }
        if (!string.IsNullOrWhiteSpace(page.Search)) q = q.Where(u => u.Name.Contains(page.Search) || (u.Email != null && u.Email.Contains(page.Search)));
        var count = await q.CountAsync(ct); var accounts = await q.OrderBy(u => u.Name).ThenBy(u => u.Id).Skip((page.PageNumber - 1) * page.PageSize).Take(page.PageSize).ToListAsync(ct);
        var result = new List<UserDto>(); foreach (var account in accounts) result.Add(await ToDtoAsync(account));
        return new(result, page.PageNumber, page.PageSize, count);
    }
    public async Task SetRoleAsync(Guid id, string role, CancellationToken ct)
    {
        if (!Roles.All.Contains(role)) throw new AppException(400, "Invalid role.");
        var account = await FindAsync(id);
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            var oldRoles = await users.GetRolesAsync(account);
            if (oldRoles.Contains(Roles.Admin) && role != Roles.Admin) await EnsureAnotherAdminAsync(id, ct);
            Check(await users.RemoveFromRolesAsync(account, oldRoles)); Check(await users.AddToRoleAsync(account, role));
            Check(await users.UpdateSecurityStampAsync(account)); await RevokeUserTokensAsync(id, ct); await tx.CommitAsync(ct);
        });
    }
    public async Task SetStatusAsync(Guid id, bool active, CancellationToken ct)
    {
        var account = await FindAsync(id);
        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            if (!active && await users.IsInRoleAsync(account, Roles.Admin)) await EnsureAnotherAdminAsync(id, ct);
            account.IsActive = active; Check(await users.UpdateAsync(account)); Check(await users.UpdateSecurityStampAsync(account));
            await RevokeUserTokensAsync(id, ct); await tx.CommitAsync(ct);
        });
    }
    // Called inside serializable role/status transactions to prevent removing the final active Admin.
    private async Task EnsureAnotherAdminAsync(Guid id, CancellationToken ct)
    {
        var other = await (from u in db.Users join ur in db.UserRoles on u.Id equals ur.UserId join role in db.Roles on ur.RoleId equals role.Id where u.Id != id && u.IsActive && role.Name == Roles.Admin select u.Id).AnyAsync(ct);
        if (!other) throw AppException.Conflict("At least one active administrator must remain.");
    }
    private async Task<AuthResponse> IssueAsync(Account account, Guid family, CancellationToken ct)
    {
        var roles = await users.GetRolesAsync(account);
        var expires = DateTimeOffset.UtcNow.AddMinutes(jwt.AccessTokenMinutes);
        var claims = new List<Claim> {
            new(JwtRegisteredClaimNames.Sub,account.Id.ToString()), new(JwtRegisteredClaimNames.Email,account.Email!), new(JwtRegisteredClaimNames.Jti,Guid.NewGuid().ToString()),
            new("security_stamp",account.SecurityStamp!), new("sid",family.ToString()) };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        var token = new JwtSecurityToken(jwt.Issuer, jwt.Audience, claims, DateTime.UtcNow, expires.UtcDateTime, new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)), SecurityAlgorithms.HmacSha256));
        // Return the random token only to the caller; persist its hash for lookup and revocation.
        var rawRefresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        db.RefreshTokens.Add(new RefreshToken { UserId = account.Id, TokenHash = Hash(rawRefresh), FamilyId = family, ExpiresAt = DateTimeOffset.UtcNow.AddDays(jwt.RefreshTokenDays) });
        await db.SaveChangesAsync(ct);
        return new(new JwtSecurityTokenHandler().WriteToken(token), rawRefresh, expires, new(account.Id, account.Name, account.Email!, roles.Single(), account.CreatedAt, account.IsActive));
    }
    private Task RevokeFamilyAsync(Guid family, CancellationToken ct) => db.RefreshTokens.Where(t => t.FamilyId == family && t.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow), ct);
    private Task RevokeUserTokensAsync(Guid id, CancellationToken ct) => db.RefreshTokens.Where(t => t.UserId == id && t.RevokedAt == null).ExecuteUpdateAsync(s => s.SetProperty(t => t.RevokedAt, DateTimeOffset.UtcNow), ct);
    private async Task<Account> FindAsync(Guid id) => await users.FindByIdAsync(id.ToString()) ?? throw AppException.NotFound("User");
    private async Task<UserDto> ToDtoAsync(Account a) => new(a.Id, a.Name, a.Email!, (await users.GetRolesAsync(a)).Single(), a.CreatedAt, a.IsActive);
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static void Check(IdentityResult result)
    {
        if (!result.Succeeded) throw new FluentValidation.ValidationException(result.Errors.Select(e => new FluentValidation.Results.ValidationFailure(e.Code, e.Description)));
    }
}
