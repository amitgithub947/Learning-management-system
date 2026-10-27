# Final LMS verification — 27 October 2026

Parts 1–3 are integrated in the existing application. Executed on macOS ARM64 with .NET SDK 10.0.401, SQL Server 2022, and Angular 22.

| Check | Executed result |
|---|---|
| Backend restore and build | Passed; 0 warnings, 0 errors |
| `dotnet test LMS.sln --no-build` | 72 passed, 0 failed, 0 skipped |
| `./scripts/test-sql.sh` | 22 passed against real SQL Server, including concurrent certificate issuance |
| EF pending model changes | None |
| Database migrations | All three applied, including AdvancedLearning; original data retained |
| `npm run build` | Passed; production bundle generated |
| `npm test -- --watch=false` | 23 passed across 11 files |
| TypeScript unused imports/parameters | Enabled in application compilation; production build passed |
| `npm audit` | 0 vulnerabilities |
| NuGet vulnerable package check, including transitive dependencies | No vulnerable packages reported |
| Generated certificate | Downloaded, parsed as one page, rendered and visually inspected |

## Actual browser workflow

The Angular frontend used real API requests and the existing SQL database throughout:

1. Trainer created a required assignment and published timed quiz on Practical TypeScript.
2. New Student registered, logged in, enrolled and completed its required lesson.
3. Lesson progress reached 100%, while the enrollment correctly remained active with assignment and quiz requirements outstanding.
4. Student submitted an answer. Trainer reviewed the saved submission and awarded 90/100 with feedback.
5. Student started the quiz, selected an answer and reloaded the page. The selected answer returned and the timer continued against its server deadline.
6. Student submitted and received 100%, with correct-answer review available after submission.
7. The server completed the enrollment. Student issued a certificate and downloaded the actual PDF.
8. After logout, the public verification page confirmed the certificate using its verification code.
9. Mobile public verification was checked at 390px without document overflow.
10. Admin analytics showed six courses, twelve users, six enrollments, one completed enrollment, 90% assignment performance and 100% quiz pass rate. The trainer performance table attributed the completion to the owning trainer.

Screenshots in `docs/screenshots/`: `assignment-grading.jpg`, `quiz-attempt.jpg`, `quiz-result.jpg`, `course-completed.jpg`, `certificates.jpg`, `mobile-certificate-verification.jpg`, and `admin-analytics.jpg`. Earlier course/enrollment/responsive checks remain in [VERIFICATION-PART2.md](VERIFICATION-PART2.md).

The browser QA records remain as development learning data; the original seed users/courses are preserved. No runtime mock API or fabricated success response is used.

## Basic xUnit unit tests

Added 29 isolated validation cases under `backend/LMS.Tests/Unit` using Fact, Theory, InlineData and the Unit category. Executed `dotnet test backend/LMS.Tests --filter Category=Unit`: 29 passed. Reran the entire default backend suite: 72 passed, 0 failed, 0 skipped. The basic suite needs no database or running API. See the [test guide](backend/LMS.Tests/README.md).

## Automated security and business checks

The suites cover registration/login, role authorization, refresh rotation and revocation, trainer course ownership, duplicate enrollments, lesson completion, assignment deadlines and authorized grading, quiz answer privacy, cross-question/duplicate option validation, exact automatic scoring, server expiry, idempotent submission, configurable completion, empty-course behavior, certificate eligibility, duplicate issuance, PDF downloads, public verification, and owner access restrictions. SQL tests exercise real migrations, constraints, rowversion handling and simultaneous certificate issuance. Angular tests cover authentication, guards, course/quiz/certificate contracts and key quiz-builder, timer/draft-restoration and progress-ring behavior.

Resource ownership and enrollment checks are server-enforced. Completed attempts are immutable; published quiz definitions are locked after attempts. Certificate downloads require the owner or Admin, while public verification exposes only certificate facts. Completion and issuance use serializable transactions with uniqueness constraints. EF parameterization, request validators, existing JWT configuration and refresh-token rotation remain in place. Authentication and public certificate verification are rate-limited. Production secrets are not embedded in the source. These checks are an implementation review, not an independent penetration test.

## PDF inspection

`output/pdf/learnwell-certificate.pdf` is a real issued certificate. It contains the student's name, course, trainer, completion date, certificate number and verification code. The one-page landscape PDF was rendered to PNG and inspected for clipping, spacing and legibility. The configured certificate timezone is Asia/Kolkata and is printed explicitly. Lato fonts are embedded with their OFL notice; PDFsharp is pinned to MIT-licensed 6.2.4.

## Environment and operation

- SQL Server is healthy on host port 14330; port 1433 was occupied. API is configured for port 5080 and Angular for 4200.
- SQL Server runs through linux/amd64 emulation on this Apple Silicon machine. This is not a Microsoft-supported native ARM deployment; use supported x86-64 SQL Server or remote SQL Server/Azure SQL for that requirement.
- `scripts/ef.sh` handles local EF tooling resolution in this workspace's trailing-space directory.
- SQL integration tests create and drop isolated `LMS_Tests_*` databases without resetting the LMS database.
- Demo passwords remain in the ignored `.demo-password` file and local secrets.
- The temporary Angular preview is stopped after verification; start it using the commands in [README.md](README.md). SQL Server and the backend are retained for development.

No remaining build, test, migration or local startup blockers were found.
