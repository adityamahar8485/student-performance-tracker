# Student Performance Tracker & Analytics Dashboard

A three-role (Admin / Teacher / Student) marks and performance management system — teachers record scores, students track their own progress and rank, and admins get an institution-wide analytics view. **All analytics and ranking are computed server-side with MongoDB aggregation pipelines** (`$group`, `$avg`, `$sort`, `$lookup`, `$project`, `$setWindowFields`, `$rank`) — never with JavaScript loops, and never by sorting fetched data in the frontend.

Built for the Data Tech Alpha full-stack internship assignment (#3).

## Screenshots

**Admin — the board**: analytics notices (needs-attention pinned red), the pending lock request, top performers, institution trend sheet, and the pass/fail register.

![Admin board](docs/screenshots/admin-board.png)

| Teacher — marks entry | Student — score trend |
|---|---|
| ![Teacher marks entry](docs/screenshots/teacher-marks.png) | ![Student score trend](docs/screenshots/student-trend.png) |

| Student — performance & rank | Admin — mobile |
|---|---|
| ![Student performance](docs/screenshots/student-performance.png) | ![Admin on mobile](docs/screenshots/admin-mobile.png) |

More: [data tables on mobile](docs/screenshots/tables-mobile.png)

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 (Vite) · React Router v6 · Tailwind CSS v4 · Recharts · axios |
| Backend | Node.js + Express.js |
| Database | MongoDB Atlas (free M0) via Mongoose |
| Auth | JWT (Bearer) + bcrypt (12 rounds) + role middleware |
| Deploy | Backend → Render (free) · Frontend → Vercel (free) |

## Demo accounts

After running the demo seed (below):

| Role | Email | Password |
|---|---|---|
| Admin | `adityamahar8485@gmail.com` | `Admin@2026` |
| Teacher | `priya.nair@school.dev` (also rahul.menon / sneha.kulkarni) | `Teacher@2026` |
| Student | `aarav.sharma@student.dev` (24 seeded students) | `Student@2026` |

The dataset includes **6 subjects, 3 teachers, 24 students across two batches (2025/2026), 18 exams** (including locked exams and one pending lock request) **and 320 marks** with a realistic score spread — enough for every analytics view, rank, chart, and empty/locked state to be demoed.

All passwords are bcrypt-hashed before they are stored (the `User` model's pre-save hook); the database never holds plaintext passwords.

## Setup

### 1. Prerequisites

- Node.js ≥ 20
- A free MongoDB Atlas M0 cluster ([create one here](https://cloud.mongodb.com)):
  - **Database user** (Atlas → Security → Database Users) with read/write role
  - **Network access**: `0.0.0.0/0` (required for Render — its egress IPs rotate)

### 2. Backend (`/server`)

```bash
cd server
npm install
cp .env.example .env     # then fill in the values (see table below)
npm run seed:demo        # admin + full demo dataset (or: npm run seed for admin only)
npm run dev              # API on http://localhost:5000
```

**Environment variables** (`server/.env`):

| Variable | What it is |
|---|---|
| `PORT` | API port (default 5000; Render injects its own) |
| `NODE_ENV` | `development` locally, `production` on Render |
| `MONGO_URI` | Atlas connection string (see note below) |
| `JWT_SECRET` | Random hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin seeder values (password is bcrypt-hashed on save; production refuses to seed without an explicit `ADMIN_PASSWORD`) |
| `CLIENT_URL` | Frontend origin for CORS (comma-separate multiple) |

> **`MONGO_URI` note:** use the standard SRV string from Atlas (`mongodb+srv://user:pass@host/db?retryWrites=true&w=majority`). Our dev machine's DNS blocks Node's SRV lookups, so the committed *example* also documents a host-list equivalent — on Atlas → Connect → Drivers both forms are shown.

### 3. Frontend (`/client`)

```bash
cd client
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:5000
npm run dev              # app on http://localhost:5173
```

### 4. Tests

With the API running on port 5000:

```bash
cd server
# full end-to-end suite (wipes the DB, seeds fixtures, 50 assertions)
node tests/wipe.mjs && npm run seed && python tests/e2e.py

# demo-data verification (13 assertions over the seeded dataset)
npm run seed:demo && python tests/verify-demo.py
node tests/verify-hash.mjs   # proves the admin password is stored bcrypt-hashed
```

The E2E suite walks the entire graded flow with hand-computed expected values: role setup → exam creation → bulk marks → corrections → lock request → admin lock → locked-edit rejection → analytics numbers → student rank/trend → access control.

> **Before demoing:** the E2E suite replaces the demo dataset with its own fixtures — re-run `npm run seed:demo` to restore the demo accounts. Note the login rate limit (20 attempts / 15 min per visitor) applies while testing many accounts quickly.

## API reference

All responses are JSON `{ "success": true, "data": … }` or `{ "success": false, "message": … }`. Authenticated routes take `Authorization: Bearer <token>`. Role middleware: every `/api/admin|teacher|student` route is gated to its role.

### Auth
| Method & path | Body → Response |
|---|---|
| `POST /api/auth/login` | `{ email, password }` → `{ token, user: { id, name, email, role, batch } }` |

### Admin
| Method & path | Body → Response |
|---|---|
| `POST /api/admin/subjects` | `{ name, code, totalMarks }` → subject |
| `GET /api/admin/subjects` | → subjects with `teacher` + `studentCount` |
| `POST /api/admin/teachers` | `{ name, email, password, subject }` → teacher + assignment |
| `GET /api/admin/teachers` | → teachers with held subjects |
| `POST /api/admin/students` | `{ name, email, password, batch, subjects: [id] }` → student + enrollments |
| `GET /api/admin/students` | → students with enrolled subjects |
| `GET /api/admin/exams` | → all exams with subject, teacher, lock flags |
| `PATCH /api/admin/exams/:id/lock` | `{ isLocked: true|false }` → updated lock state (**the only path that locks**) |
| `GET /api/admin/analytics` | → `{ avgPerSubject, passFailPerSubject, topPerformers, lowestAvgSubject, examTrend, totals }` — all computed by aggregation pipelines in `services/analyticsService.js` |

### Teacher (own subjects only — enforced on every route)
| Method & path | Body → Response |
|---|---|
| `GET /api/teacher/subjects` | → assigned subjects + enrolled count |
| `POST /api/teacher/exams` | `{ subject, name, date, maxMarks }` → exam |
| `GET /api/teacher/exams` | → own exams with lock status |
| `POST /api/teacher/exams/:id/marks` | `{ marks: [{ student, score }] }` → bulk upsert (rejects unenrolled students, scores > max, locked exams) |
| `PATCH /api/teacher/marks/:id` | `{ score }` → corrected entry (403 when the exam is locked; %, grade, pass recomputed) |
| `GET /api/teacher/exams/:id/results` | → marks table incl. enrolled-but-unmarked students |
| `PATCH /api/teacher/exams/:id/request-lock` | → flags the exam for admin review |

### Student (own data only)
| Method & path | Response |
|---|---|
| `GET /api/student/subjects` | enrolled subjects with totals, %, grade per subject |
| `GET /api/student/performance` | cumulative %, overall grade, **batch rank (aggregation `$setWindowFields` + `$rank`)**, cohort size, grade breakdown |
| `GET /api/student/subjects/:id/trend` | chronological score trend for one subject (Recharts data) |

### Grading (computed server-side)

| Percentage | Grade | | Pass rule |
|---|---|---|---|
| ≥ 90 | A | | pass = score ≥ **40% of the exam's max marks** |
| 75–89 | B | 40–59 | D |
| 60–74 | C | < 40 | F |

## Documented design decisions (spec ambiguities)

The assignment leaves a few points open; these are the choices made, visible in code and tests:

1. **Registration model** — the endpoint list contains only `POST /api/auth/login`. Teachers and students are *registered by the admin* (assignment + enrollment in the same call); the admin itself is created by the seeder, never by a public route.
2. **"Rank within their enrolled batch"** — interpreted as the student's cohort (`User.batch`, set at registration). Rank is computed by a `$setWindowFields` + `$rank` pipeline against every marked student in the same batch. Students without marks are unranked but counted rules-wise as outside the cohort.
3. **Pass/fail per subject** — counted **per mark entry** against the 40%-of-exam-max rule, recomputed inside the pipeline from raw values (not cached flags).
4. **"Average score per subject"** — cumulative percentage (Σscore / ΣmaxMarks), not the mean of per-exam percentages (they differ when exams carry different max marks).
5. **Lock flow** — two flags: `lockRequested` (teacher asks) → `isLocked` (admin decides, via `PATCH /api/admin/exams/:id/lock`). Only `isLocked` blocks edits; a request alone does not.

## Deployment

### Backend → Render (free)

1. New Web Service → connect the repo → **Root directory** `server`
2. Build command `npm install` · Start command `npm start` (honors Render's `PORT`)
3. Environment variables: `MONGO_URI` (the **SRV** string), `JWT_SECRET`, `CLIENT_URL` = your Vercel URL, `NODE_ENV=production`, `ADMIN_PASSWORD` (required in production — the seeder refuses a default)
4. Health check path: `/api/health`. The app sets `trust proxy` for Render's edge, so rate limits key per visitor. Note: free-tier services sleep — the first request after idle takes ~30–60 s.

### Frontend → Vercel (free)

1. New project → import repo → **Root directory** `client` (framework auto-detected: Vite)
2. Environment variable: `VITE_API_URL` = the Render URL (baked at build time — set it before deploying)
3. `client/vercel.json` already ships the SPA rewrite so React Router deep links work.

## Repository layout

```
├── client/            # React (Vite) — Tailwind v4, React Router, Recharts
│   └── src/pages/     # admin / teacher / student dashboards
├── server/            # Express + Mongoose
│   └── src/
│       ├── models/     # User, Subject, Enrollment, Exam (lock flags), Mark (unique index + grade hook)
│       ├── services/   # ALL aggregation pipelines (analytics, rank, student summaries)
│       ├── controllers/, routes/, middleware/ (JWT protect + role gates)
│       └── seed.js     # npm run seed | npm run seed:demo
└── docs/screenshots/
```

No credentials are committed: both `.env` files are git-ignored, and `.env.example` files carry placeholders only.
