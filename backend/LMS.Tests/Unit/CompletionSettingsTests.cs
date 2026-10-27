using LMS.Application;
using Xunit;

namespace LMS.Tests.Unit;

[Trait("Category", "Unit")]
public sealed class CompletionSettingsTests
{
    [Theory]
    [InlineData(false, false, false, false)]
    [InlineData(true, false, false, true)]
    [InlineData(false, true, false, true)]
    [InlineData(false, false, true, true)]
    [InlineData(true, true, true, true)]
    public void CourseCompletion_RequiresAtLeastOneEnabledRule(
        bool lessons, bool assignments, bool quizzes, bool expectedValid)
    {
        var settings = new CompletionSettings(lessons, assignments, quizzes);

        var result = new CompletionSettingsValidator().Validate(settings);

        Assert.Equal(expectedValid, result.IsValid);
    }
}
