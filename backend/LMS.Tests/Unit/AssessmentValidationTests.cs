using LMS.Application;
using LMS.Domain;
using Xunit;

namespace LMS.Tests.Unit;

[Trait("Category", "Unit")]
public sealed class AssessmentValidationTests
{
    [Fact]
    public void ValidAssignment_PassesValidation()
    {
        var request = ValidAssignment();

        var result = new AssignmentValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    public void NonPositiveMaximumMarks_IsRejected(int maximumMarks)
    {
        var request = ValidAssignment() with { MaximumMarks = maximumMarks };

        var result = new AssignmentValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(AssignmentRequest.MaximumMarks));
    }

    [Fact]
    public void PastAssignmentDeadline_IsRejected()
    {
        var request = ValidAssignment() with { DueDate = DateTimeOffset.UtcNow.AddDays(-1) };

        var result = new AssignmentValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(AssignmentRequest.DueDate));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(101)]
    public void PassingPercentageOutsideAllowedRange_IsRejected(int percentage)
    {
        var request = ValidAssignment() with { PassingPercentage = percentage };

        var result = new AssignmentValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(AssignmentRequest.PassingPercentage));
    }

    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, true, false)]
    [InlineData(true, false, true)]
    public void SingleChoice_RequiresExactlyOneCorrectOption(bool firstCorrect, bool secondCorrect, bool expectedValid)
    {
        var question = new QuestionRequest("Which option?", QuestionType.SingleChoice, 1,
            [new OptionRequest("First", firstCorrect), new OptionRequest("Second", secondCorrect)]);

        var result = new QuestionValidator().Validate(question);

        Assert.Equal(expectedValid, result.IsValid);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("   ", false)]
    [InlineData("interface", true)]
    public void FreeText_RequiresAnExpectedAnswer(string? answer, bool expectedValid)
    {
        var question = new QuestionRequest("Type the keyword", QuestionType.FreeText, 1, [], answer);

        var result = new QuestionValidator().Validate(question);

        Assert.Equal(expectedValid, result.IsValid);
    }

    [Fact]
    public void DuplicateQuestionAnswers_AreRejected()
    {
        var questionId = Guid.NewGuid();
        var request = new QuizSubmitRequest([new AnswerRequest(questionId, []), new AnswerRequest(questionId, [])]);

        var result = new QuizSubmitValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(QuizSubmitRequest.Answers));
    }

    [Fact]
    public void DuplicateSelectedOptions_AreRejected()
    {
        var optionId = Guid.NewGuid();
        var request = new QuizSubmitRequest([new AnswerRequest(Guid.NewGuid(), [optionId, optionId])]);

        var result = new QuizSubmitValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == "Answers[0].SelectedOptionIds");
    }

    private static AssignmentRequest ValidAssignment() =>
        new("Build a course model", "Submit the interface definition.", DateTimeOffset.UtcNow.AddDays(7), 100, 50);
}
