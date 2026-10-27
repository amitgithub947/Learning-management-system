using FluentValidation;
using LMS.Domain;
namespace LMS.Application;

public sealed class CreateAssignmentValidator : AbstractValidator<CreateAssignmentRequest>
{
    public CreateAssignmentValidator()
    {
        RuleFor(x => x.CourseId).NotEmpty();
        RuleFor(x => x).Custom((r, context) => { var result = new AssignmentValidator().Validate(new AssignmentRequest(r.Title, r.Description, r.DueDate, r.MaximumMarks, r.PassingPercentage, r.IsRequired)); foreach (var error in result.Errors) context.AddFailure(error); });
    }
}
public sealed class CompletionSettingsValidator : AbstractValidator<CompletionSettings>
{ public CompletionSettingsValidator() { RuleFor(x => x).Must(x => x.RequireLessons || x.RequireAssignments || x.RequireQuizzes).WithMessage("Enable at least one completion requirement."); } }
public sealed class QuizValidator : AbstractValidator<QuizRequest>
{
    public QuizValidator()
    {
        RuleFor(x => x.CourseId).NotEmpty(); RuleFor(x => x.Title).NotEmpty().MaximumLength(200); RuleFor(x => x.Description).NotEmpty().MaximumLength(10000);
        RuleFor(x => x.PassingPercentage).InclusiveBetween(1, 100).PrecisionScale(5, 2, false);
        RuleFor(x => x.TimeLimitMinutes).InclusiveBetween(1, 1440).When(x => x.TimeLimitMinutes.HasValue);
        RuleFor(x => x.Questions).NotNull().Must(q => q is { Count: >= 1 and <= 50 }).WithMessage("Include 1 to 50 questions.");
        RuleForEach(x => x.Questions).SetValidator(new QuestionValidator());
    }
}
public sealed class QuestionValidator : AbstractValidator<QuestionRequest>
{
    public QuestionValidator()
    {
        RuleFor(x => x.QuestionText).NotEmpty().MaximumLength(10000); RuleFor(x => x.QuestionType).IsInEnum();
        RuleFor(x => x.Marks).GreaterThan(0).LessThanOrEqualTo(100000).PrecisionScale(10, 2, false);
        RuleFor(x => x.Options).NotNull(); RuleForEach(x => x.Options).ChildRules(o => o.RuleFor(x => x.OptionText).NotEmpty().MaximumLength(4000));
        RuleFor(x => x.ExpectedAnswer).MaximumLength(2000);
        RuleFor(x => x).Must(x => x.QuestionType switch
        {
            QuestionType.FreeText => x.Options is { Count: 0 } && !string.IsNullOrWhiteSpace(x.ExpectedAnswer),
            QuestionType.SingleChoice => x.Options is { Count: >= 2 and <= 8 } && x.Options.Count(o => o.IsCorrect) == 1,
            QuestionType.MultipleChoice => x.Options is { Count: >= 2 and <= 8 } && x.Options.Any(o => o.IsCorrect),
            _ => false
        }).WithMessage("Choice questions need 2–8 options and valid correct answers. Text questions need an expected answer and no options.");
    }
}
public sealed class QuizSubmitValidator : AbstractValidator<QuizSubmitRequest>
{
    public QuizSubmitValidator()
    {
        RuleFor(x => x.Answers).NotNull().Must(a => a is { Count: <= 50 } && a.Select(x => x.QuestionId).Distinct().Count() == a.Count).WithMessage("Provide each question at most once.");
        RuleForEach(x => x.Answers).ChildRules(a =>
        {
            a.RuleFor(x => x.QuestionId).NotEmpty(); a.RuleFor(x => x.Text).MaximumLength(10000);
            a.RuleFor(x => x.SelectedOptionIds).NotNull().Must(ids => ids is { Count: <= 8 } && ids.Distinct().Count() == ids.Count).WithMessage("Answer options must be unique.");
        });
    }
}
