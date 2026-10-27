using LMS.Application;
using Xunit;

namespace LMS.Tests.Unit;

[Trait("Category", "Unit")]
public sealed class RegistrationValidationTests
{
    [Fact]
    public void ValidRegistration_PassesValidation()
    {
        // Arrange
        var request = new RegisterRequest("Test Student", "student@example.test", "Learning!12345");
        var validator = new RegisterValidator();

        // Act
        var result = validator.Validate(request);

        // Assert
        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-an-email")]
    [InlineData("student@")]
    public void InvalidEmail_ReturnsEmailError(string email)
    {
        var request = new RegisterRequest("Test Student", email, "Learning!12345");

        var result = new RegisterValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Email));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void MissingName_ReturnsNameError(string name)
    {
        var request = new RegisterRequest(name, "student@example.test", "Learning!12345");

        var result = new RegisterValidator().Validate(request);

        Assert.Contains(result.Errors, error => error.PropertyName == nameof(RegisterRequest.Name));
    }

    [Theory]
    [InlineData(11, false)]
    [InlineData(12, true)]
    [InlineData(128, true)]
    [InlineData(129, false)]
    public void PasswordLength_EnforcesBothBoundaries(int length, bool expectedValid)
    {
        // Character complexity is enforced separately by ASP.NET Core Identity.
        var request = new RegisterRequest("Test Student", "student@example.test", new string('a', length));

        var result = new RegisterValidator().Validate(request);

        Assert.Equal(expectedValid, result.IsValid);
    }
}
