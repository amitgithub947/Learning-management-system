# Backend tests

This project uses xUnit. Basic unit tests live in `Unit/` and run without Docker, a database, an HTTP server or application secrets.

## Run only basic unit tests

From the repository root:

```bash
dotnet test backend/LMS.Tests --filter Category=Unit
```

The 29 cases cover registration field and password-length boundaries, assignment deadlines and marks, passing percentages, quiz question rules, duplicate answers/options, and course completion settings. Password complexity is enforced by ASP.NET Core Identity and covered separately by API tests.

## Run all backend tests

```bash
dotnet test LMS.sln
```

Existing business-service and API integration tests use isolated relational SQLite databases by default. Actual SQL Server integration tests can also be run with `./scripts/test-sql.sh`; see the root README for configuration.

## Basic xUnit example

`RegistrationValidationTests.ValidRegistration_PassesValidation` demonstrates Arrange → Act → Assert:

1. Arrange a valid request and its validator.
2. Act by calling `Validate`.
3. Assert that `result.IsValid` is true.

`[Fact]` runs one scenario. `[Theory]` with `[InlineData]` runs the same test for multiple inputs. Each unit test class has `[Trait("Category", "Unit")]` so the basic suite is easy to run independently. Rejected-input tests check the relevant error property to ensure the intended rule caused the failure.
