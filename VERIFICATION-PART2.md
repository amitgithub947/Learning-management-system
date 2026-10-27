# Part 2 verification

Part 2 extends the working Part 1 repository with Angular 22 and six backend read endpoints. It preserves the original authentication and mutation contracts and requires no schema migration.

## Automated checks

| Check | Result |
|---|---|
| Angular production build | Passed |
| Angular unit tests (Vitest) | 13 passed across 5 files; 0 failures |
| `npm audit` | 0 vulnerabilities |
| .NET build | Passed; 0 warnings, 0 errors |
| .NET suite | 35 passed; 0 failures, 0 skipped |
| Real SQL Server API suite | 14 passed; migrations applied to isolated test databases |
| EF model consistency | No pending model changes |

The additional backend tests verify that public outlines never expose lesson content or video URLs, drafts remain hidden, progress is scoped to the current Student, dashboard counts follow role/resource boundaries, other trainers cannot read a course's students, and user/course filters query real records. They run against both SQLite in the default suite and actual SQL Server in the additional API run.

Angular tests verify that tokens never enter localStorage, access tokens remain in memory, session restoration rotates refresh tokens, concurrent refreshes share one request, logout does not resurrect a pending session, external requests never receive the bearer token, concurrent 401s retry with one rotated token, route guards restrict roles, and progress requests follow the real API contract.

## Browser integration checklist

All requested flows were exercised through the Angular UI with the development proxy forwarding requests to the running ASP.NET Core API and SQL Server:

| Workflow | Verified result |
|---|---|
| 1. Register as Student | Created a development test Student; redirected to the Student dashboard |
| 2. Log in as Student | Fresh login redirected to `/student/dashboard`; existing progress remained visible |
| 3. Browse published courses | Catalog showed real published courses and excluded the seeded draft |
| 4. Enroll in a course | Enrollment in C# Fundamentals saved to SQL Server |
| 5. Open course lessons | Learning studio fetched protected lesson text and curriculum |
| 6. Mark a lesson complete | Completion PATCH persisted the first lesson |
| 7. View updated progress | UI changed from 0% to 33%; progress page and browser reload retained 1 of 3 completed lessons |
| 8. Log in as Trainer | Role redirect opened the Trainer workspace |
| 9. Create a course | Practical TypeScript was created as a Draft |
| 10. Add lessons | Type-safe data models saved with content, duration and sequence |
| 11. Publish the course | Confirmation dialog published the course; Published status and success toast appeared |
| 12. Log in as Admin | Admin dashboard displayed SQL-backed counts and enrollment activity |
| 13. View users and courses | User and course management displayed actual accounts/courses and pagination |

Additional browser checks: canceled role changes preserve the previous role; an enrolled-student table displayed the same saved 33% progress; logout returned to login; refresh restored authenticated deep links; no browser console errors or warnings were found in the checked session.

## Responsive and visual checks

- Desktop at 1280px: role dashboard, lesson player, navigation and course management.
- Tablet at 768px: student-progress table stayed within a horizontally scrollable panel; no document overflow.
- Mobile at 390px: navigation drawer opens/closes, traps focus, and leaves off-screen navigation inert. Learning controls and curriculum stack vertically. A one-pixel player overflow found during QA was fixed; document width equals viewport width.
- Temporary viewport overrides were reset and browser test sessions logged out.

Screenshots:

- [Student dashboard](docs/screenshots/student-dashboard.jpg)
- [Learning player](docs/screenshots/learning-player.jpg)
- [Mobile learning](docs/screenshots/mobile-learning.jpg)

## Data and environment

Browser testing used three development-only test accounts (one Student, one Trainer and one Admin) and created one published Practical TypeScript course with a lesson. These are ordinary persisted records in the development database. Original seeded accounts and courses were preserved. The isolated automated SQL test databases were deleted by the test fixture.

SQL Server remains the amd64-emulated container verified in Part 1, using local port 14330. Backend development configuration and generated demo credentials are unchanged. The directory's trailing-space EF CLI resolution issue remains handled by `scripts/ef.sh`.

The frontend preview server was used for verification and stopped after QA. To run the application, start the backend if needed, then run `npm start` inside `frontend/lms-client`; open http://localhost:4200. No hosted deployment was requested or created.

## Scope and integrations

All requested Part 2 pages and API integrations are implemented. The API base URL is configured through environments. The production build expects a web server with SPA fallback and an `/api` reverse proxy (or a configured external API origin). Production hosting is not provisioned by this task.

Part 3 quiz execution, assignments UI, automatic enrollment completion, and certificate issuance remain intentionally deferred. Part 2 does not invent those workflows or represent lesson completion as certificate issuance.
