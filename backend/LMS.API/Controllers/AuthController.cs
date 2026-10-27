using LMS.Application;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace LMS.API.Controllers;

[Route("api/auth")]
[EnableRateLimiting("auth")]
public sealed class AuthController(IAuthService auth, IUserService users, ICurrentUser current) : ApiController
{
    [AllowAnonymous, HttpPost("register")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Register(RegisterRequest r, CancellationToken ct) => Success(await auth.RegisterAsync(r, ct));
    [AllowAnonymous, HttpPost("login")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Login(LoginRequest r, CancellationToken ct) => Success(await auth.LoginAsync(r, ct));
    [AllowAnonymous, HttpPost("refresh")]
    public async Task<ActionResult<ApiResponse<AuthResponse>>> Refresh(TokenRequest r, CancellationToken ct) => Success(await auth.RefreshAsync(r, ct));
    [AllowAnonymous, HttpPost("logout")]
    public async Task<ActionResult<ApiResponse<object>>> Logout(TokenRequest r, CancellationToken ct) { await auth.LogoutAsync(r, ct); return Done("Session revoked."); }
    [Authorize, HttpGet("me")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Me(CancellationToken ct) => Success(await users.GetAsync(current.Id, ct));
    [Authorize, HttpPost("change-password")]
    public async Task<ActionResult<ApiResponse<object>>> ChangePassword(ChangePasswordRequest r, CancellationToken ct) { await auth.ChangePasswordAsync(current.Id, r, ct); return Done("Password changed. Sign in again."); }
}
