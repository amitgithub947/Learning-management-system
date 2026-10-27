using System.Security.Claims;
using FluentValidation;
using LMS.Application;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace LMS.API;

/// <summary>Reads the caller from authenticated claims rather than request-supplied user IDs.</summary>
public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    public Guid Id => Guid.TryParse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : Guid.Empty;
    public bool IsInRole(string role) => accessor.HttpContext?.User.IsInRole(role) == true;
}
/// <summary>Runs the registered request validator before a controller action executes.</summary>
public sealed class ValidationFilter(IServiceProvider services) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments.Values.Where(x => x is not null))
        {
            var type = typeof(IValidator<>).MakeGenericType(argument!.GetType());
            if (services.GetService(type) is not IValidator validator) continue;
            var result = await validator.ValidateAsync(new ValidationContext<object>(argument), context.HttpContext.RequestAborted);
            if (!result.IsValid) throw new ValidationException(result.Errors);
        }
        await next();
    }
}
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var status = 500; var message = "An unexpected error occurred."; Dictionary<string, string[]>? errors = null;
        // Translate known failures into the API envelope without leaking SQL details or stack traces.
        switch (exception)
        {
            case AppException app: status = app.StatusCode; message = app.Message; break;
            case ValidationException validation:
                status = 400; message = "Validation failed.";
                errors = validation.Errors.GroupBy(e => e.PropertyName).ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray()); break;
            case DbUpdateConcurrencyException: status = 409; message = "The record was changed by another request. Reload and try again."; break;
            case DbUpdateException update when update.InnerException is SqlException sql && sql.Number is 2601 or 2627 or 547:
                status = 409; message = "The change conflicts with an existing record or a related learning record."; break;
            case BadHttpRequestException: status = 400; message = "The request is invalid."; break;
        }
        if (status == 500) logger.LogError(exception, "Unhandled error. Trace {TraceId}", context.TraceIdentifier);
        else logger.LogWarning("Request rejected with {StatusCode}. Trace {TraceId}", status, context.TraceIdentifier);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new ApiResponse<object>(false, null, message, errors, context.TraceIdentifier), ct);
        return true;
    }
}
[ApiController]
public abstract class ApiController : ControllerBase
{
    protected ActionResult<ApiResponse<T>> Success<T>(T value) => Ok(new ApiResponse<T>(true, value));
    protected ActionResult<ApiResponse<object>> Done(string message) => Ok(new ApiResponse<object>(true, null, message));
}
