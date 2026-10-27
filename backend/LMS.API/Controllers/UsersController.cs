using LMS.Application;
using LMS.Domain;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace LMS.API.Controllers;

[Authorize(Roles = Roles.Admin), Route("api/users")]
public sealed class UsersController(IUserService users) : ApiController
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<Page<UserDto>>>> List([FromQuery] UserQuery q, CancellationToken ct) => Success(await users.ListAsync(q, ct));
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserDto>>> Get(Guid id, CancellationToken ct) => Success(await users.GetAsync(id, ct));
    [HttpPatch("{id:guid}/role")]
    public async Task<ActionResult<ApiResponse<object>>> Role(Guid id, RoleRequest r, CancellationToken ct) { await users.SetRoleAsync(id, r.Role, ct); return Done("Role changed. Existing sessions revoked."); }
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<object>>> Status(Guid id, StatusRequest r, CancellationToken ct) { await users.SetStatusAsync(id, r.IsActive, ct); return Done("Account status changed. Existing sessions revoked."); }
}
