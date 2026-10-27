using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace LMS.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SeedSystemRoles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Existing development databases may already have roles created by Identity.
            // Preserve those IDs and their user-role links when upgrading.
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM [AspNetRoles] WHERE [NormalizedName] = N'ADMIN')
                    INSERT INTO [AspNetRoles] ([Id],[ConcurrencyStamp],[Name],[NormalizedName])
                    VALUES ('00000000-0000-0000-0000-000000000001',N'lms-admin-role-v1',N'Admin',N'ADMIN');
                IF NOT EXISTS (SELECT 1 FROM [AspNetRoles] WHERE [NormalizedName] = N'TRAINER')
                    INSERT INTO [AspNetRoles] ([Id],[ConcurrencyStamp],[Name],[NormalizedName])
                    VALUES ('00000000-0000-0000-0000-000000000002',N'lms-trainer-role-v1',N'Trainer',N'TRAINER');
                IF NOT EXISTS (SELECT 1 FROM [AspNetRoles] WHERE [NormalizedName] = N'STUDENT')
                    INSERT INTO [AspNetRoles] ([Id],[ConcurrencyStamp],[Name],[NormalizedName])
                    VALUES ('00000000-0000-0000-0000-000000000003',N'lms-student-role-v1',N'Student',N'STUDENT');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000001"));

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000002"));

            migrationBuilder.DeleteData(
                table: "AspNetRoles",
                keyColumn: "Id",
                keyValue: new Guid("00000000-0000-0000-0000-000000000003"));
        }
    }
}
