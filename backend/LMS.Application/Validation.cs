using FluentValidation;
using LMS.Domain;
namespace LMS.Application;

public sealed class RegisterValidator : AbstractValidator<RegisterRequest>
{
    public RegisterValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(12).MaximumLength(128);
    }
}
public sealed class LoginValidator : AbstractValidator<LoginRequest>
{
    public LoginValidator() { RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(256); RuleFor(x => x.Password).NotEmpty().MaximumLength(128); }
}
public sealed class TokenValidator : AbstractValidator<TokenRequest>
{
    public TokenValidator() { RuleFor(x => x.RefreshToken).NotEmpty().MaximumLength(256); }
}
public sealed class PasswordValidator : AbstractValidator<ChangePasswordRequest>
{
    public PasswordValidator() { RuleFor(x => x.CurrentPassword).NotEmpty().MaximumLength(128); RuleFor(x => x.NewPassword).NotEmpty().MinimumLength(12).MaximumLength(128); }
}
public sealed class RoleValidator : AbstractValidator<RoleRequest>
{
    public RoleValidator() { RuleFor(x => x.Role).Must(x => Roles.All.Contains(x)).WithMessage("Choose Admin, Trainer, or Student."); }
}
public sealed class PageValidator : AbstractValidator<PageQuery>
{
    public PageValidator() { RuleFor(x => x.PageNumber).InclusiveBetween(1, 100000); RuleFor(x => x.PageSize).InclusiveBetween(1, 100); RuleFor(x => x.Search).MaximumLength(150); }
}
public sealed class CourseQueryValidator : AbstractValidator<CourseQuery>
{
    public CourseQueryValidator()
    {
        Include(new PageValidator()); RuleFor(x => x.Category).MaximumLength(100);
        RuleFor(x => x.Sort).Must(x => new[] { "title", "newest", "oldest" }.Contains(x));
        RuleFor(x => x.Status).IsInEnum().When(x => x.Status.HasValue);
    }
}
public sealed class CourseValidator : AbstractValidator<CourseRequest>
{
    public CourseValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.Category).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ThumbnailUrl).MaximumLength(2048).Must(ValidationRules.IsHttpUrl).WithMessage("Provide an absolute HTTP(S) URL.");
    }
}
public static class ValidationRules
{
    public static bool IsHttpUrl(string? url) => string.IsNullOrWhiteSpace(url) || (Uri.TryCreate(url, UriKind.Absolute, out var parsed) && parsed.Scheme is "http" or "https");
}
public sealed class LessonValidator : AbstractValidator<LessonRequest>
{
    public LessonValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Content).NotEmpty().MaximumLength(100000);
        RuleFor(x => x.VideoUrl).MaximumLength(2048).Must(ValidationRules.IsHttpUrl);
        RuleFor(x => x.SequenceNumber).GreaterThan(0);
        RuleFor(x => x.DurationMinutes).InclusiveBetween(0, 10080);
    }
}
public sealed class EnrollmentValidator : AbstractValidator<EnrollmentRequest>
{ public EnrollmentValidator() { RuleFor(x => x.CourseId).NotEmpty(); } }
public sealed class AssignmentValidator : AbstractValidator<AssignmentRequest>
{
    public AssignmentValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.DueDate).Must(date => date > DateTimeOffset.UtcNow).WithMessage("Due date must be in the future.");
        RuleFor(x => x.PassingPercentage).InclusiveBetween(1, 100).PrecisionScale(5, 2, false);
        RuleFor(x => x.MaximumMarks).GreaterThan(0).LessThanOrEqualTo(100000).PrecisionScale(10, 2, false);
    }
}
public sealed class SubmitValidator : AbstractValidator<SubmitRequest>
{ public SubmitValidator() { RuleFor(x => x.Content).NotEmpty().MaximumLength(100000); } }
public sealed class GradeValidator : AbstractValidator<GradeRequest>
{ public GradeValidator() { RuleFor(x => x.Marks).GreaterThanOrEqualTo(0).PrecisionScale(10, 2, false); RuleFor(x => x.Feedback).MaximumLength(10000); } }

public sealed class UserQueryValidator : AbstractValidator<UserQuery>
{
    public UserQueryValidator()
    {
        Include(new PageValidator());
        RuleFor(x => x.Role).Must(x => x is null || Roles.All.Contains(x)).WithMessage("Invalid role filter.");
    }
}
