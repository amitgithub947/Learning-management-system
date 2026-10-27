using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace LMS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AdvancedLearning : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_QuizAttempts_StudentId_QuizId",
                table: "QuizAttempts");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Quizzes",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Quizzes",
                type: "nvarchar(max)",
                maxLength: 10000,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<bool>(
                name: "IsRequired",
                table: "Quizzes",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ExpiresAt",
                table: "QuizAttempts",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsExpired",
                table: "QuizAttempts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "IsPassed",
                table: "QuizAttempts",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "MaximumMarks",
                table: "QuizAttempts",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "PassingPercentage",
                table: "QuizAttempts",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "QuizAttempts",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "ExpectedAnswer",
                table: "Questions",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsRequired",
                table: "Lessons",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireAssignments",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireLessons",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "RequireQuizzes",
                table: "Courses",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAt",
                table: "Certificates",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<string>(
                name: "CourseTitle",
                table: "Certificates",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "StudentName",
                table: "Certificates",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TrainerName",
                table: "Certificates",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "VerificationCode",
                table: "Certificates",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CreatedAt",
                table: "Assignments",
                type: "datetimeoffset",
                nullable: false,
                defaultValue: new DateTimeOffset(new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)));

            migrationBuilder.AddColumn<bool>(
                name: "IsRequired",
                table: "Assignments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "PassingPercentage",
                table: "Assignments",
                type: "decimal(5,2)",
                precision: 5,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            // Preserve the existing curriculum as required activities and backfill
            // immutable verification snapshots before adding unique constraints.
            migrationBuilder.Sql("""
                UPDATE [Courses] SET [RequireLessons]=1,[RequireAssignments]=1,[RequireQuizzes]=1;
                UPDATE [Lessons] SET [IsRequired]=1;
                UPDATE [Assignments] SET [IsRequired]=1,[PassingPercentage]=50,[CreatedAt]=SYSUTCDATETIME();
                UPDATE [Quizzes] SET [IsRequired]=1,[CreatedAt]=SYSUTCDATETIME();
                UPDATE [Quizzes] SET [PassingPercentage]=70 WHERE [PassingPercentage]<=0 OR [PassingPercentage]>100;
                UPDATE a SET [MaximumMarks]=ISNULL((SELECT SUM(q.[Marks]) FROM [Questions] q WHERE q.[QuizId]=a.[QuizId]),0),
                    [PassingPercentage]=q.[PassingPercentage],
                    [ExpiresAt]=CASE WHEN q.[TimeLimitMinutes] IS NULL THEN NULL ELSE DATEADD(minute,q.[TimeLimitMinutes],a.[StartedAt]) END
                FROM [QuizAttempts] a JOIN [Quizzes] q ON a.[QuizId]=q.[Id];
                ;WITH duplicates AS (SELECT [Id],ROW_NUMBER() OVER(PARTITION BY [StudentId],[QuizId] ORDER BY [StartedAt] DESC,[Id]) n FROM [QuizAttempts] WHERE [CompletedAt] IS NULL)
                UPDATE a SET [CompletedAt]=SYSUTCDATETIME(),[Score]=0,[IsExpired]=1 FROM [QuizAttempts] a JOIN duplicates d ON a.[Id]=d.[Id] WHERE d.n>1;
                UPDATE c SET [VerificationCode]=REPLACE(CONVERT(varchar(36),NEWID()),'-',''),
                    [StudentName]=u.[Name],[CourseTitle]=co.[Title],[TrainerName]=t.[Name],
                    [CompletedAt]=ISNULL(e.[CompletedAt],c.[IssuedAt])
                FROM [Certificates] c JOIN [AspNetUsers] u ON c.[StudentId]=u.[Id] JOIN [Courses] co ON c.[CourseId]=co.[Id]
                JOIN [AspNetUsers] t ON co.[TrainerId]=t.[Id] LEFT JOIN [Enrollments] e ON e.[CourseId]=c.[CourseId] AND e.[StudentId]=c.[StudentId];
                """);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Quiz_Passing",
                table: "Quizzes",
                sql: "[PassingPercentage] > 0 AND [PassingPercentage] <= 100");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Quiz_Time",
                table: "Quizzes",
                sql: "[TimeLimitMinutes] IS NULL OR ([TimeLimitMinutes] >= 1 AND [TimeLimitMinutes] <= 1440)");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_StudentId_QuizId",
                table: "QuizAttempts",
                columns: new[] { "StudentId", "QuizId" },
                unique: true,
                filter: "[CompletedAt] IS NULL");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAnswers_QuizAttemptId_QuestionId_SelectedOptionId",
                table: "QuizAnswers",
                columns: new[] { "QuizAttemptId", "QuestionId", "SelectedOptionId" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Question_Marks",
                table: "Questions",
                sql: "[Marks] > 0");

            migrationBuilder.CreateIndex(
                name: "IX_Certificates_VerificationCode",
                table: "Certificates",
                column: "VerificationCode",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_Assignment_Passing",
                table: "Assignments",
                sql: "[PassingPercentage] > 0 AND [PassingPercentage] <= 100");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Quiz_Passing",
                table: "Quizzes");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Quiz_Time",
                table: "Quizzes");

            migrationBuilder.DropIndex(
                name: "IX_QuizAttempts_StudentId_QuizId",
                table: "QuizAttempts");

            migrationBuilder.DropIndex(
                name: "IX_QuizAnswers_QuizAttemptId_QuestionId_SelectedOptionId",
                table: "QuizAnswers");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Question_Marks",
                table: "Questions");

            migrationBuilder.DropIndex(
                name: "IX_Certificates_VerificationCode",
                table: "Certificates");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Assignment_Passing",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "IsRequired",
                table: "Quizzes");

            migrationBuilder.DropColumn(
                name: "ExpiresAt",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "IsExpired",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "IsPassed",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "MaximumMarks",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "PassingPercentage",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "QuizAttempts");

            migrationBuilder.DropColumn(
                name: "ExpectedAnswer",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "IsRequired",
                table: "Lessons");

            migrationBuilder.DropColumn(
                name: "RequireAssignments",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "RequireLessons",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "RequireQuizzes",
                table: "Courses");

            migrationBuilder.DropColumn(
                name: "CompletedAt",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "CourseTitle",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "StudentName",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "TrainerName",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "VerificationCode",
                table: "Certificates");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "IsRequired",
                table: "Assignments");

            migrationBuilder.DropColumn(
                name: "PassingPercentage",
                table: "Assignments");

            migrationBuilder.CreateIndex(
                name: "IX_QuizAttempts_StudentId_QuizId",
                table: "QuizAttempts",
                columns: new[] { "StudentId", "QuizId" });
        }
    }
}
