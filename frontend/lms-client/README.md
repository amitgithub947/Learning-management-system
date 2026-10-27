# Learnwell Angular frontend

Angular 22 standalone application integrated with the ASP.NET Core API and real SQL Server records. All three LMS parts are implemented. See the [root setup guide](../../README.md) for architecture, database, secrets, seed accounts, API contracts and prerequisites, and the [executed verification report](../../VERIFICATION.md) for results.

## Run locally

Terminal 1:

```bash
cd '/Users/amitgupta/LMS '
docker compose up -d --wait
./scripts/migrate.sh
dotnet run --project backend/LMS.API
```

Terminal 2:

```bash
cd '/Users/amitgupta/LMS /frontend/lms-client'
npm ci
npm start
```

Open http://localhost:4200. The development proxy forwards `/api` to port 5080. Production defaults to `/api`; serve the build with SPA fallback and reverse-proxy API requests to ASP.NET. Configure a separate origin and backend CORS when deploying separately.

## Organization

`src/app/core` contains typed contracts, auth state, guards, interceptors and API services. `shared` contains common controls, confirmation dialogs, course navigation, charts and progress rings. `layouts` provides public and role-specific workspaces. Features and pages load lazily under parent role guards.

| Feature | Routes and behavior |
|---|---|
| Public catalog | `/`, `/courses`, `/courses/:id`; published catalog, filters, sort, pagination and enrollment |
| Authentication | `/login`, `/register`, `/account/profile`, `/account/change-password` |
| Admin | `/admin/dashboard`, `/admin/users`, `/admin/trainers`, `/admin/courses` |
| Trainer | `/trainer/dashboard`, `/trainer/courses`, course creation/editing, lessons and enrolled students |
| Student | `/student/dashboard`, `/student/courses`, `/student/learn/:id`, `/student/progress` |
| Assignments | `/{admin,trainer,student}/assignments`, `/assignments/:id`; course selection, search, pagination and details |
| Assignment editing | `/{admin,trainer}/assignments/new`, `/assignments/:id/edit`; deadlines, thresholds and required flag |
| Submission and grading | Embedded in assignment details; Student answer form, Trainer review table, marks and feedback |
| Quizzes | `/{admin,trainer,student}/quizzes`; scoped course list and search |
| Quiz builder | `/{admin,trainer}/quizzes/new`, `/quizzes/:id/edit`; single choice, multiple choice, short text, correctness, marks, passing and timing |
| Attempts | `/student/quiz-attempts/:id`; server deadline, tab answer restoration, submit confirmation and automatic expiry submission |
| Results | `/{admin,trainer,student}/quiz-attempts/:id/result`, `/quizzes/:id/history`; score, outcome, review and history |
| Trainer results | `/{admin,trainer}/quizzes/:id/results`; authorized student results |
| Completion | `/student/progress/:id`; lesson ring, required activities, marks, unmet requirements and certificate action |
| Completion rules | `/{admin,trainer}/courses/:id/completion` |
| Analytics | `/{admin,trainer}/analytics`; real course outcomes, charts, assignment performance, quiz pass rates and admin trainer overview |
| Certificates | `/student/certificates`; search, pagination, authenticated PDF download and verification links |
| Public verification | `/certificates/verify`, `/certificates/verify/:code`; accessible without login |

Assignment, quiz, progress and certificate features are under matching directories in `src/app/features`. `advanced.routes.ts` supplies lazy assessment routes; `app.routes.ts` supplies parent role boundaries and public verification.

## Integration and UI behavior

Typed HttpClient services use `environment.apiBaseUrl`; components do not embed backend origins. Student selections use their enrolled courses; managers use authorized course portfolios. The backend owns scoring, eligibility, completion and issuance. Empty, loading and retryable error states, responsive tables, toasts and confirmations are shared consistently.

An assignment has one submission per student and requires a trainer grade to pass. Multiple-choice scoring requires the exact correct set; short-text scoring ignores surrounding whitespace and case. Correct answers are hidden until an attempt is completed. Refreshing an active attempt restores its tab draft and fetches the authoritative deadline. An expired attempt receives zero. Once attempts exist, quiz definitions are immutable. Issued certificates preserve original identity/course snapshots and lock course completion criteria.

Access tokens stay in memory; rotating refresh tokens use sessionStorage. Concurrent 401s share one refresh request. Logout revokes the token family and clears state. Guards improve navigation, while API ownership, enrollment and role checks remain authoritative. Lesson content uses escaped text, and supported video embeds use validated hosts/IDs.

The interface includes labeled reactive forms, keyboard focus, skip navigation, mobile drawer focus controls and reduced-motion support. Charts display persisted API data. Tables scroll within their container. Certificate download uses HttpClient with authentication, then a local blob URL.

## Build and tests

```bash
npm run build
npm test -- --watch=false
npm audit
```

Output: `dist/lms-client/browser`. The final executed run passed all 23 tests in 11 files and reported zero audit vulnerabilities. Application compilation enforces unused local/parameter checks. Tests cover authentication, route guards, course, quiz and certificate services, builder validation, attempt timer/draft behavior and progress-ring rendering. HTTP mocks are test-only.

## Appearance

Header controls on public pages and every role workspace switch between light and dark mode. The preference is stored locally under `learnwell-theme` and applied before Angular starts; first-time visits follow the system theme. Text sizes are increased across navigation, forms, tables and dashboards. The toggle remains available on mobile, and charts and Material controls follow the active theme.
