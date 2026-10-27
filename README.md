# Learnwell LMS

A complete Learning Management System with an Angular frontend, ASP.NET Core Web API, and SQL Server persistence. Parts 1–3 are implemented in the same codebase: identity and courses, role-based workspaces, assignments, timed quizzes, server-calculated completion, PDF certificates, and analytics.

## Contents

- [First-time installation](#installation-and-environment)
- [Start the website](#exact-local-startup-commands)
- [Stop and restart](#stop-and-restart)
- [Demo login and registration](#demo-accounts-and-sample-data)
- [Student, Trainer and Admin instructions](#step-by-step-user-guide)
- [Font size and dark mode](#appearance-and-dark-mode)
- [Technology and architecture](#technology-and-architecture)
- [Database design](#database-design)
- [Prerequisites and Apple Silicon](#prerequisites)
- [Configuration and environment variables](#installation-and-environment)
- [API and Swagger instructions](#api-documentation-and-contracts)
- [Assessment and completion rules](#assessment-and-completion-policies)
- [Authentication and security](#authentication-and-security)
- [Database migrations](#database-migrations)
- [xUnit and Angular testing](#testing)
- [Common errors](#troubleshooting)
- [Related guides and verification](#related-guides-and-verification)

The commands below use this machine's actual workspace path, **`/Users/amitgupta/LMS `**, which includes a trailing space. Keep the quotes and the space. On another machine, replace that path with your checkout directory.

## Features

- Public landing page, searchable/filterable/sortable course catalog, course details and lesson outlines.
- ASP.NET Core Identity, Student-only public registration, Admin/Trainer/Student authorization, JWTs, refresh-token rotation, password changes, account status and role management.
- Trainer-owned course and lesson editing, course publication, enrollment lists and student progress.
- Assignment creation/editing/deletion, deadlines, submissions, grading, marks and feedback.
- Quiz builder with single choice, multiple choice and short-text questions; server timing/scoring, attempt resumption, result review and history.
- Required lessons, assignment thresholds, required quizzes and configurable course-level completion rules.
- Idempotent enrollment completion and certificate issuance; protected PDF downloads and public verification.
- Student progress charts, trainer learning analytics, admin completion statistics and trainer performance.
- Responsive layouts, accessible forms/navigation, loading skeletons, toasts, confirmation dialogs and error states.

Runtime data always comes from real APIs and SQL Server. Test doubles exist only in automated tests.

## Technology and architecture

.NET 10 LTS / C#, EF Core 10, SQL Server 2022, ASP.NET Core Identity, JWT bearer authentication, FluentValidation, Serilog, Swagger/OpenAPI, xUnit. Angular 22, TypeScript 6, standalone components, Signals, RxJS, HttpClient, Reactive Forms, Angular Material, Tailwind CSS 4, Chart.js/ng2-charts and Vitest. Certificates use the MIT-licensed PDFsharp **6.2.4** with embedded Lato fonts, keeping PDF generation portable across macOS/Linux/Windows.

```text
LMS.sln
backend/
  LMS.Domain/              Framework-independent entities and enums
  LMS.Application/         Contracts, validation, authorization/business services, ports
  LMS.Infrastructure/      Identity, SQL mappings/migrations, transactional assessments,
                           completion, certificates, embedded PDF fonts and analytics
  LMS.API/                 Controllers, HTTP validation, middleware, DI and OpenAPI
  LMS.Tests/               Business rules, API integration, SQLite and SQL Server tests
frontend/lms-client/
  src/app/core/            Auth, guards, interceptors, typed contracts and API services
  src/app/shared/          Reusable components, progress ring, course navigation, pipes
  src/app/layouts/         Public and responsive role dashboard layouts
  src/app/features/        Auth, public, admin, trainer, student, courses, lessons,
                           enrollments, assignments, quizzes, progress, certificates
scripts/                   Secure dev setup, EF wrapper, migration and SQL test commands
.config/dotnet-tools.json  Pinned EF CLI
docker-compose.yml        Local SQL Server service
output/pdf/               Certificate generated through the completed workflow
docs/screenshots/         Browser verification captures
```

Dependencies flow from API to Application/Infrastructure, Infrastructure to Application, and Application to Domain. Identity implementation stays in Infrastructure. `ILmsDbContext` exposes the unit of work for application services; `IUnitOfWork` supplies serializable transactions with SQL Server transient retries. `ICurrentUser` derives identity from authenticated claims. No permission relies on a hidden frontend button.

## Database design

Identity owns users, password hashes, roles, lockout and security stamps. Courses reference their trainer; enrollments reference course/student; lessons and assignments belong to courses. Submissions link assignments to students. Lesson progress has a unique student/lesson pair.

Quizzes own ordered questions and answer options. Attempts snapshot their start, deadline, maximum marks and passing percentage. Answers reference attempt/question/selected option. Certificates have unique student/course issuance and verification codes, and snapshot the student/course/trainer names and completion date.

Foreign keys and deliberate delete behaviors preserve enrollment, submission, quiz-attempt and certificate history. Unique indexes protect normalized emails, enrollments, lesson progress, lesson order, assignment submissions, active quiz attempts, answers and certificates. Marks/percentages have explicit decimal precision and database checks. Courses, refresh tokens and quiz attempts use rowversion where appropriate.

Three checked-in migrations create the initial schema, seed roles, and add advanced learning fields/constraints. The advanced migration backfills existing course requirements and verification snapshots; it preserves the Part 1–2 records.

## Prerequisites

- .NET SDK **10.0.401** or a compatible newer .NET 10 SDK (`global.json` allows feature roll-forward).
- Node **26**, or Node 24.15+ / 22.22.3+ compatible with Angular 22. See [Angular's compatibility table](https://angular.dev/reference/versions).
- npm, Docker with Compose, Bash and OpenSSL.
- A reachable SQL Server. The local container needs adequate memory and amd64 support.

### Apple Silicon

SQL Server has **no native ARM64 image**. Compose explicitly uses `platform: linux/amd64` with `mcr.microsoft.com/mssql/server:2022-latest`. It was verified healthy here under Docker's amd64 emulation, with local port **14330** because 1433 was occupied.

Microsoft supports SQL Server containers on x86-64 Linux, and does not support emulation. If local emulation fails, connect to an x86-64 SQL Server host or Azure SQL instead. Configure Docker's amd64/Rosetta option where available. See [Microsoft's container support guidance](https://learn.microsoft.com/en-us/sql/linux/containers/deploy?view=sql-server-linux-ver15). No native Apple Silicon support is assumed.

## Installation and environment

From this workspace:

```bash
cd '/Users/amitgupta/LMS '
dotnet tool restore
dotnet restore LMS.sln

# Fresh checkout only. Already configured in this workspace.
./scripts/configure-dev.sh

docker compose up -d --wait
./scripts/migrate.sh
```

The development setup script generates independent random SQL, JWT and demo-account secrets. It writes ignored `.env`, .NET API user-secrets and owner-readable `.demo-password`. It refuses to replace an existing `.env` so database passwords are not accidentally changed. Do not commit or publish those files. User-secrets are local development storage; use a real secret store for deployment.

For an existing workspace, skip `configure-dev.sh` and retain the current secrets. To use a different port on a fresh checkout, run `SQL_PORT=14331 ./scripts/configure-dev.sh`.

| Configuration / environment variable | Purpose |
|---|---|
| `ConnectionStrings__DefaultConnection` | SQL Server connection; API user-secrets are used locally |
| `Jwt__SigningKey` | Cryptographically random signing secret, at least 32 bytes; no production default |
| `Jwt__Issuer`, `Jwt__Audience` | Token issuer/audience; defaults `LMS` / `LMS.Angular` |
| `Jwt__AccessTokenMinutes`, `Jwt__RefreshTokenDays` | Defaults 15 minutes / 7 days; startup-validated bounds |
| `Cors__AllowedOrigins__0` | Angular origin; local default `http://localhost:4200` |
| `AllowedHosts` | Allowed API hosts; local defaults only |
| `Seed__Enabled`, `Seed__Password` | Development-only demo seeding |
| `Database__MigrateOnStartup` | Opt-in Development-only automatic migration |
| `Certificates__DisplayTimeZone` | PDF completion-date timezone; configured `Asia/Kolkata`, printed explicitly |
| `MSSQL_SA_PASSWORD`, `SQL_PORT` | Compose SQL development password and local host port |

Use a trusted SQL certificate in deployment (`Encrypt=True;TrustServerCertificate=False`) and a least-privilege application login. The local development connection permits the container's self-signed certificate. Production requires HTTPS, correct host/CORS configuration and explicit database migration. If using a reverse proxy, configure trusted forwarded headers rather than trusting arbitrary client headers.

### Remote SQL Server

```bash
dotnet user-secrets set --project backend/LMS.API 'ConnectionStrings:DefaultConnection' '<your SQL Server connection string>'
dotnet user-secrets set --project backend/LMS.API 'Jwt:SigningKey' '<random signing secret of at least 32 bytes>'
./scripts/migrate.sh
```

Roles are seeded by migrations in every environment. Production administrator provisioning is an operator responsibility; the application does not create a default production administrator.

## Exact local startup commands

Open Docker Desktop and wait until its engine is running. For the first installation, complete [Installation and environment](#installation-and-environment) first. For normal use, run the following in two separate terminals and leave both running.

Terminal 1 — backend:

```bash
cd '/Users/amitgupta/LMS '
docker compose up -d --wait
./scripts/migrate.sh
dotnet run --project backend/LMS.API
```

Terminal 2 — frontend:

```bash
cd '/Users/amitgupta/LMS /frontend/lms-client'
npm ci
npm start
```

If the API is already running, do not run another copy. You can check it with:

```bash
curl -fsS http://localhost:5080/health
```

A response containing `"status":"healthy"` confirms the API process is responding. This endpoint is a liveness check, not a database connectivity check. If the backend is already available, run only the frontend commands above. `npm ci` is needed after a fresh checkout or dependency changes; on subsequent launches, `npm start` is sufficient.

Open:

- Angular app: http://localhost:4200
- API Swagger: http://localhost:5080/swagger
- API liveness: http://localhost:5080/health
- Public certificate verification: http://localhost:4200/certificates/verify

The Angular development proxy forwards `/api` to port 5080. Components never hardcode the backend origin. Both environment files default to `/api`; production hosting needs SPA fallback to `index.html` and an `/api` reverse proxy, or a configured external API base URL with matching CORS. Build output is `frontend/lms-client/dist/lms-client/browser`.

`docker compose stop` stops SQL without deleting its named volume. Stop each local application server with Ctrl+C. Avoid starting a second API or Angular server on an occupied port.

## Stop and restart

1. Press **Ctrl+C** in the Angular terminal to stop the frontend.
2. Press **Ctrl+C** in the backend terminal to stop the API.
3. To stop the database while preserving data:

```bash
cd '/Users/amitgupta/LMS '
docker compose stop
```

To start again, use the two [startup terminals](#exact-local-startup-commands). Do not use `docker compose down -v` for a normal restart: it removes the database volume and its saved learning records.

To inspect service status:

```bash
cd '/Users/amitgupta/LMS '
docker compose ps
lsof -nP -iTCP:5080 -sTCP:LISTEN
lsof -nP -iTCP:4200 -sTCP:LISTEN
```

`lsof` commands above are for macOS/Linux and identify a process using the API/frontend port. Stop the appropriate process in its original terminal before starting a replacement.

## Demo accounts and sample data

Development-only seeding creates:

| Email | Role |
|---|---|
| `admin@lms.local` | Admin |
| `trainer1@lms.local`, `trainer2@lms.local` | Trainer |
| `student1@lms.local` through `student5@lms.local` | Student |

To sign in, open http://localhost:4200/login and enter an email from the table. All demo accounts use the generated password in **`.demo-password`**. To read it locally:

```bash
cd '/Users/amitgupta/LMS '
cat .demo-password
```

Keep this password private; do not include it in screenshots, commits or shared logs. Existing passwords are never reset. The seeder creates five courses, fifteen lessons and four enrollments; four courses are published. C# Fundamentals and ASP.NET Core APIs also receive sample assignments and published knowledge checks when none exist. Existing assessment work and certified curricula are preserved.

Browser verification added development test users and a Practical TypeScript course, completed an assignment/quiz journey and issued a real certificate. These are additional persisted test records, not runtime mocks.

## Pages and workflows

Public: landing, catalog, course details, login, registration and certificate verification. Authenticated users have profile/password settings.

Admin: overview, user/trainer management, all courses, assignments/submissions/grading, quizzes/results, learning analytics, trainer performance and course completion settings.

Trainer: own courses/lessons/publication, enrolled students, assignments/grading, quiz builder/results, completion requirements and analytics scoped to owned courses.

Student: dashboard, enrolled library, lesson player, progress charts, assignments/marks/feedback, quiz attempts/history/review, detailed course requirements and PDF certificates.

Each course's workspace navigation connects lessons, assignments, quizzes and progress. Completing a lesson updates saved lesson progress immediately; completing a course depends on the configured assessment requirements as well.

## Step-by-step user guide

### Register a new Student

1. Open http://localhost:4200/register or select **Get started**.
2. Enter your full name and a valid email address.
3. Choose a password of **12–128 characters** containing uppercase, lowercase, a number and a symbol.
4. Enter the same password in **Confirm password**, then select **Create my account**.
5. Successful registration signs you in to the Student workspace. If you already have an account, use **Log in** instead.

Public registration creates a Student account. A user cannot select Admin or Trainer during registration. Read the inline validation/error message if registration is rejected; password requirements apply to both the frontend and the backend Identity policy.

### Student workflow

1. Open **Browse courses** and choose a published course.
2. Open its details and enroll.
3. Use **My learning → Continue learning** to open lessons and mark each finished lesson complete.
4. Open **Assignments**, select the enrolled course, read its deadline and submit your answer. After grading, return to see marks and feedback.
5. Open **Quizzes**, choose a published quiz and start an attempt. Answer and submit before the timer expires. Results and history show saved scores and completed-attempt reviews.
6. Open the course's progress/requirements page to check lessons, assignment thresholds and quiz requirements.
7. When all server-calculated requirements pass, select the certificate action. Open **Certificates** to download the PDF or follow its verification link.
8. Anyone can open http://localhost:4200/certificates/verify and enter the certificate's verification code without signing in.

Completing every lesson can show 100% lesson progress while required assignments/quizzes are still outstanding. See [assessment policies](#assessment-and-completion-policies) for eligibility, deadlines and retry behavior.

### Trainer workflow

1. Log in using a Trainer account.
2. Open **My courses → Create a course**, enter course details and save.
3. Add lessons with content/video, sequence, duration and required status; publish when the course is ready.
4. In **Assignments**, select your course and create assignments with deadlines, maximum marks, passing percentage and required status.
5. Open an assignment's submissions to review answers, enter marks and add feedback.
6. In **Quizzes**, create questions and options/expected answers, set timing and passing percentage, and publish the quiz.
7. Use course completion settings to choose which requirement groups count toward completion.
8. Check enrolled students, quiz results and **Analytics** to see actual learner outcomes.

Trainers manage their own courses. Learning history and issued certificates restrict destructive edits, as explained in the assessment policies.

### Admin workflow

1. Log in using the Admin account.
2. Use **User management** to find users and manage roles/account status. To add a Trainer, have the person register as a Student, then assign the Trainer role as Admin.
3. Review **Trainer management**, all courses, enrolled learners, assignments and quizzes.
4. Open **Analytics** for platform totals, course outcomes and trainer performance.
5. Role/status changes invalidate affected sessions; the affected user must sign in again. The last active Admin cannot be deactivated or demoted.

### Profile and logout

Use **Account settings** to view your profile or change your password. A password change requires signing in again. Use **Log out** to end the current session and revoke its refresh-token family.

## Appearance and dark mode

Text is enlarged across navigation, forms, tables and dashboards. Use the **Dark mode / Light mode** button in the page header to switch themes. On narrow screens, the same control uses a moon/sun icon with an accessible label.

Your choice is saved in this browser under `learnwell-theme` and restored after refreshing or reopening the website. Before any preference is saved, the initial theme follows the system setting. If browser storage is unavailable, the control still works for the current page but may not persist after refresh. This appearance preference is separate from authentication data.

## API documentation and contracts

Swagger is enabled in Development/Testing. Requests use `Authorization: Bearer <accessToken>`. JSON envelopes are `{ success, data, message, errors, traceId }`; list data has `{ items, pageNumber, pageSize, totalCount }`. Pagination defaults to 1/20, with a maximum page size of 100. Dates are ISO 8601 UTC and enums are strings.

| Area | Endpoints |
|---|---|
| Authentication | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/change-password`; `GET /api/auth/me` |
| Courses | `GET/POST /api/courses`; `GET/PUT/DELETE /api/courses/{id}`; `PATCH /api/courses/{id}/publish`; `GET /api/courses/my-courses`, `/categories`, `/{id}/overview` |
| Lessons | `GET/POST /api/courses/{courseId}/lessons`; `GET/PUT/DELETE /api/lessons/{id}`; `PATCH /api/lessons/{id}/complete` |
| Enrollments | `POST /api/enrollments`; `GET /api/enrollments/my-courses`, `/course/{courseId}` |
| Users | `GET /api/users`, `/{id}`; `PATCH /api/users/{id}/role`, `/{id}/status` |
| Assignments | `GET /api/courses/{courseId}/assignments`; `POST /api/assignments`; `GET/PUT/DELETE /api/assignments/{id}`; `POST /api/assignments/{id}/submit`; `GET /api/assignments/{id}/submissions`; `PATCH /api/submissions/{id}/grade` |
| Quizzes | `POST /api/quizzes`; `GET /api/courses/{courseId}/quizzes`; `GET/PUT/DELETE /api/quizzes/{id}`; `POST /api/quizzes/{id}/attempts`; `GET /api/quizzes/{id}/results` |
| Attempts | `GET /api/quiz-attempts/{id}`; `POST /api/quiz-attempts/{id}/submit`; `GET /api/quiz-attempts/{id}/result` |
| Progress | `GET /api/dashboard`, `/api/analytics`; `GET /api/progress/my-courses`; `GET /api/progress/courses/{id}`, `/{id}/summary`; `GET /api/courses/{id}/students`; `GET/PUT /api/courses/{id}/completion-settings` |
| Certificates | `GET /api/certificates/my`, `/{id}/download`, `/verify/{code}`; `POST /api/certificates/course/{courseId}/issue` |

### Try a protected endpoint in Swagger

1. Open http://localhost:5080/swagger while the backend runs in Development.
2. Expand `POST /api/auth/login`, select **Try it out**, and enter your existing account's email and password.
3. Execute the request and copy the `accessToken` from the response's `data` object.
4. Select **Authorize** and supply the token as directed by the Swagger bearer field. The HTTP request must contain `Authorization: Bearer <accessToken>`.
5. Try an endpoint permitted for that user's role. Do not share token-bearing screenshots or responses. Public catalog and certificate verification endpoints do not need a token.

Original Part 1 assignment aliases remain supported: nested course assignment creation and `POST /api/assignments/{id}/submissions`.

Courses support `search`, `category`, `sort=title|newest|oldest`; management also accepts `status`. Users support `search`, `role`, `isActive`. Assignment, quiz, progress and certificate lists expose applicable search/pagination. See Swagger and the typed Angular services for exact request bodies.

Errors: 400 validation, 401 missing/expired session, 403 permission denied, 404 missing resource, 409 conflicting/immutable learning records, 429 rate limit. Stack traces and secrets are not returned.

## Assessment and completion policies

**Assignments:** due dates must be in the future when created/updated; marks are positive and passing thresholds are 1–100%. Students need enrollment and must submit before the deadline. There is one submission per student/assignment. Only the owner trainer or Admin can grade; marks must be within the maximum. Grading criteria cannot change after submissions exist. Assignments with submissions are retained.

**Quizzes:** single-choice questions have exactly one correct option; multiple-choice scoring requires the exact correct set, with no partial credit. Short-text answers compare trimmed, Unicode-normalized text ignoring case. The builder explains this policy. A quiz supports 1–50 questions, 2–8 options per choice question, and an optional 1–1440 minute time limit.

Correct flags/expected answers are omitted as values for students before submission. Grading keys are returned only to authorized managers or in an authorized completed-attempt review. The server snapshots the deadline and scoring thresholds. One active attempt per student/quiz is allowed; starting again resumes it. Reloading the frontend restores the server timer and tab-scoped draft answers. Answers received at/after the deadline score zero and the attempt is expired. A completed attempt cannot be modified; duplicate valid submit requests return its saved result. New attempts are allowed after completion. Quiz definitions are immutable after the first attempt to protect grading integrity.

**Completion:** lesson percentage is completed lessons / total lessons × 100, with zero for a course with no lessons. Course eligibility separately checks all enabled requirements: required lessons completed, required assignments passed and at least one passing attempt for each required quiz. An empty set of required activities cannot earn a certificate. Required draft quizzes block completion until published and passed. Changes before certification recalculate enrollments; repeated successful evaluations preserve the original completion date.

**Certificates:** only the authenticated eligible Student can issue their own certificate. A serializable transaction and unique student/course index prevent duplicates. Issuance snapshots names/date and creates a random verification code. Downloads require the owner or Admin. Public verification returns the certificate facts, not email addresses or protected lesson content. Curriculum/completion criteria lock after the course's first certificate; a certified student's marks cannot subsequently be changed. Create a new course version for curriculum changes. PDF generation uses embedded fonts, and its configured date timezone is printed explicitly.

## Authentication and security

Public registration always assigns Student. Only Admin can assign roles or change account status; the last active Admin cannot be demoted/deactivated. Trainers can create courses and manage only their own resources; Admin can manage all course resources. Enrollment and attempt ownership are checked on the backend.

Identity hashes passwords and enforces 12-character mixed-complexity passwords and five-attempt/15-minute lockout. JWT issuer/audience/signature/algorithm/lifetime are validated. Refresh tokens are random, stored only as SHA-256 hashes, rotated transactionally and revoked as a family on reuse. Session/stamp checks invalidate access after logout, password, role or status changes.

Angular keeps access tokens in memory and refresh tokens in tab-scoped `sessionStorage`, never `localStorage`. Concurrent 401s share one refresh. Production cookie-based auth would be a different contract requiring CSRF controls; this app retains the actual JSON token contract.

Authentication is limited to 30 requests/minute/IP; public certificate verification to 60. EF Core parameterizes runtime queries; sorting is whitelisted. Lesson text uses safe interpolation and video iframes are restricted to validated YouTube/Vimeo hosts. Certificate downloads use authenticated HttpClient requests. Logs avoid request bodies, tokens and credentials. [Verification](VERIFICATION.md) records the security checks and their evidence; this is an application-level review, not an external penetration test.

## Database migrations

```bash
./scripts/migrate.sh

# After future model changes:
./scripts/ef.sh migrations add YourMigrationName \
  --project backend/LMS.Infrastructure --startup-project backend/LMS.API \
  --output-dir Persistence/Migrations

# Generate reviewable deployment SQL:
./scripts/ef.sh migrations script --idempotent \
  --project backend/LMS.Infrastructure --startup-project backend/LMS.API \
  --output backend/lms-migrations.sql

./scripts/ef.sh migrations has-pending-model-changes \
  --project backend/LMS.Infrastructure --startup-project backend/LMS.API
```

The design-time factory reads `ConnectionStrings__DefaultConnection`; `migrate.sh` supplies the API user-secret connection if that variable is absent. `ef.sh` falls back to the restored tool entry DLL because the installed SDK cannot resolve `dotnet ef` in this workspace's directory, whose name ends with a space. Normal paths may use the equivalent standard `dotnet ef` commands.

Automatic migration and demo seeding are restricted to Development and opt-in. Apply production migrations through your deployment process before starting the API.

## Testing

Basic xUnit tests can run independently without SQL Server or Docker:

```bash
dotnet test backend/LMS.Tests --filter Category=Unit
```

The basic suite contains 29 cases for registration, password length, assignment deadlines/marks, quiz validation and completion settings. `[Fact]` runs one scenario; `[Theory]` and `[InlineData]` run a test against multiple inputs. Each test follows **Arrange → Act → Assert** and is marked `[Trait("Category", "Unit")]`.

Example from the existing tests:

```csharp
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
```

Add more basic tests under `backend/LMS.Tests/Unit/`, import `Xunit` and the relevant application namespace, and keep the Unit category for tests that need no database or HTTP host. See the [backend test guide](backend/LMS.Tests/README.md) for details.

To run a single class, or save a test report:

```bash
dotnet test backend/LMS.Tests --filter FullyQualifiedName~RegistrationValidationTests
dotnet test backend/LMS.Tests --filter Category=Unit --logger trx --results-directory TestResults
```

The latest executed runs passed **29 basic unit tests**, **72 tests in the complete default backend suite**, **22 real SQL Server integration tests**, and **23 Angular tests**. The 29 unit tests are included within the 72 backend total; the SQL run executes the API tests separately against SQL Server. See [verification evidence](VERIFICATION.md) for the recorded runs.

```bash
# Repository root
dotnet restore LMS.sln
dotnet build LMS.sln --no-restore
dotnet test LMS.sln --no-build
./scripts/test-sql.sh

# Frontend
cd frontend/lms-client
npm ci
npm run build
npm test -- --watch=false
npm audit
```

The default backend tests use relational SQLite with test-only date/decimal/rowversion mappings. The SQL run applies real migrations to fresh `LMS_Tests_<guid>` databases, runs the API/Identity/JWT stack and removes those databases. Use a local development SQL login with CREATE DATABASE permission. It does not reset the LMS database.

The integration test includes registration → login → enrollment → lesson completion → assignment submission → trainer grading → quiz scoring → eligibility → PDF certificate → public verification. SQL tests also exercise simultaneous certificate issuance. Angular tests cover auth, guards, course/quiz/certificate services and important builder, timer, answer-restoration and progress-ring UI behavior. The production app uses no HTTP test mocks.

Current executed results, browser workflow captures, PDF rendering and environment details: [VERIFICATION.md](VERIFICATION.md). Historical Part 1–2 reports remain available separately. [Frontend guide](frontend/lms-client/README.md) documents page routes and implementation organization.

## Troubleshooting

- **Registration password error:** use 12–128 characters with uppercase, lowercase, a number and a symbol; both password fields must match. An already registered email should use Log in.
- **`Failed to bind ... 5080: address already in use`:** another API process is running. Check `/health`; if healthy, use the running backend and start only Angular. To restart it, stop its original terminal process first.
- **`localhost:4200` cannot be reached:** run `npm start` from `frontend/lms-client`, keep the terminal open, and wait for the local URL before refreshing the browser.
- **`Port 4200 is already in use`:** use the existing frontend or stop it before restarting. Keep 4200 aligned with the configured development CORS origin.
- **`npm` command/dependency errors:** check `node --version` against the prerequisites, change into `frontend/lms-client`, run `npm ci`, then retry.
- **Docker daemon unavailable:** start Docker Desktop and wait for it to become ready before running Compose.
- **Database startup/connection failure:** check `docker compose ps` and `docker compose logs --tail=100 sqlserver`; retain the existing connection/password configuration and verify the SQL host port.
- **Dark mode or font changes not visible:** refresh the page after the Angular rebuild completes. Theme choice is browser-local; disabled storage can prevent persistence.
- **Port occupied:** SQL uses 14330 here. Stop the existing API/Angular process before restarting on 5080/4200; keep connection strings and Compose ports aligned.
- **SQL container fails on ARM:** enable available amd64 emulation or use remote SQL Server/Azure SQL. Emulation is not Microsoft-supported.
- **API startup rejects JWT/connection configuration:** run secure setup on a fresh checkout or restore the required user-secrets; no insecure fallback is supplied.
- **`dotnet ef` says restore again:** use `dotnet tool restore` and `scripts/ef.sh`; the trailing-space path is handled by the wrapper.
- **Demo accounts missing:** migrate first; enable Development seeding and configure `Seed:Password`. Existing passwords are not reset.
- **409 while editing/deleting:** learning history or issued certificates prevent destructive changes; inspect the message and create a new course/quiz version where needed.
- **100% lesson progress but no certificate:** open course requirements; required assignments/quizzes may still be outstanding.
- **Expired quiz scores zero:** deadlines are server-enforced. Start a new attempt and submit before the deadline.
- **Public verification not found:** copy the complete 32-character code from an issued certificate.
- **Frontend API network failures:** check backend port 5080, the development proxy, configured API base URL and allowed origin.
- **Production deep links return 404:** configure SPA fallback and keep `/api` forwarded to the backend.

PDFsharp 6.2.4 is pinned intentionally; later releases use a different licensing model. See [its MIT package license](https://www.nuget.org/packages/PDFsharp/6.2.4) and the embedded fonts' [OFL notice](backend/LMS.Infrastructure/Certificates/Fonts/OFL.txt).


## Related guides and verification

- [Frontend guide](frontend/lms-client/README.md): page routes, API integration, appearance and frontend build commands.
- [Backend test guide](backend/LMS.Tests/README.md): basic xUnit examples and test selection.
- [Final verification report](VERIFICATION.md): actual executed results, browser workflow and environment notes.
- [Part 2 verification](VERIFICATION-PART2.md): earlier authentication, course and responsive UI checks.
- [Browser screenshots](docs/screenshots/): desktop/mobile examples, dark mode, assessments, analytics and certificates.
- [Generated sample certificate](output/pdf/learnwell-certificate.pdf): PDF produced through the verified learning workflow.
