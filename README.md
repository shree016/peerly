# Peeerly

Peeerly is a student platform with these core features:

| Feature | Routes |
| --- | --- |
| **Login / Sign-up** (email + password, Google; Better Auth) | `/auth/login`, `/auth/signup` |
| **Live Quiz** (admin builder, live presenter, play by join code, analytics, PDF reports) | `/quiz`, `/quiz/join`, `/quiz/play/[id]` |
| **Placement Experiences** (share, browse, rounds, JD/resources, Q&A, coordinator verify) | `/experiences` |
| **Polls**: Quick Polls (single/multiple choice, yes-no, short answer + live wall) and **SeatLock** (limited seats per option, first come first served) | `/polls`, `/polls/[id]`, `/polls/roster` |
| **Admin** (roles, suspensions, audit log) | `/admin/users`, `/admin/audit` |

There are also a few new pages: a landing page (`/`), a dashboard (`/dashboard`) and a profile page (`/profile`).

Stack: Next.js 16 · React 19 · Tailwind v4 · Drizzle + Neon Postgres · Better Auth · Supabase Realtime · S3 · Resend · OpenAI.

## Setup

```bash
npm install --legacy-peer-deps
```

### 1. Environment

Copy `.env.example` to `.env.local` and fill in the values.

Notable variables:

- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN`: e.g. `bmsce.ac.in` for a "college email only" rule. Leave it empty to allow any email.
- `SUPER_ADMIN_EMAILS`: the owner account(s). Once their email is verified they are always admin, and can't be removed or suspended from the UI. New owner accounts must be created with Google, because password sign-up is blocked for these addresses. Set it only in `.env.local` or Vercel, **never in code**.

### 2. Database

1. Create a Neon project and put its URL in `DATABASE_URL`.
2. Create the tables:
   ```bash
   npm run db:migrate   # applies every migration in drizzle/
   ```
3. Bootstrap roles (one time). Sign in once with the owner account using Google, then run:
   ```bash
   npm run roles:bootstrap
   ```
   > **Production upgrade from pre-RBAC:** `0003` and `0004` are additive. They leave the old `is_coordinator` / `is_elective_poll_admin` columns in place so the live site keeps working. `0005` drops those columns, so run `npm run db:migrate` again **only after** the RBAC code is deployed.

   This makes the `SUPER_ADMIN_EMAILS` accounts admin. Optional `BOOTSTRAP_ACTIVITY_COORDINATOR_EMAILS` and `BOOTSTRAP_FACULTY_EMAILS` grant those roles in the same run. Remove the `BOOTSTRAP_*` variables afterwards. From then on, roles are managed at `/admin/users`.

## Roles & access (RBAC)

Code checks **permissions** (e.g. `poll:manage`), never role names. Which role has which permission lives in [lib/permissions/roles.ts](lib/permissions/roles.ts). Who holds which role is stored in the database (`user.role`) and changed only from `/admin/users`. Every change is audited.

| Role | Polls | Roster | Other |
| --- | --- | --- | --- |
| `student` (default) | respond | – | – |
| `faculty` | manage + export | view, edit, export | – |
| `placement_coordinator` | manage | view, edit | verify/moderate experiences, official drive templates |
| `activity_coordinator` | manage | view | quizzes |
| `admin` | everything | everything | roles, suspensions, audit log |

- A user can hold several roles.
- Peeerly always keeps at least one admin.
- Better Auth's own `/api/auth/admin/*` endpoints are blocked. Every role change goes through the audited server actions in `features/admin`.
- Server checks (`requirePermission`) are the real gate. Hiding UI is cosmetic.

## Student data (this repo is public)

- Roster data enters **only** through the import on `/polls/roster`, straight into the database. Never commit rosters, seed files with real students, or exports. `.gitignore` blocks `*.csv`, `*students*.json`, `*roster*.json` and `scripts/data/*`. Use [scripts/data/students.example.csv](scripts/data/students.example.csv) (fake data) as the template.
- Student-facing APIs and realtime broadcasts carry counts only, never identities. Anonymous polls never reveal who answered what.
- Roster imports, edits, deletions and every export are recorded in the audit log.

### 3. OAuth / app URL

Production runs on **https://peeerly.tech**. For production (e.g. Vercel env vars) set:

- `BETTER_AUTH_URL=https://peeerly.tech` and `NEXT_PUBLIC_APP_URL=https://peeerly.tech`
- In Google Cloud Console, add the authorized redirect URI `https://peeerly.tech/api/auth/callback/google`
- In Resend, verify `peeerly.tech` and use e.g. `RESEND_FROM_EMAIL=Peeerly <noreply@peeerly.tech>`

For any other domain, swap it in the same places.

### 4. Run

```bash
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm run build
npm run test:polls # RBAC + poll visibility rules (no DB needed)
```

## Theme

The design tokens live in `app/globals.css`:

- Periwinkle `primary`
- Brand accents `sky`, `sun`, `candy`, `mint` and `ink`, available as Tailwind classes (`bg-sun-soft`, `bg-ink`, …)
- Helpers: `peeerly-card`, `peeerly-chip`, `peeerly-rays`

Fonts are Poppins for headings (via `font-serif`) and Plus Jakarta Sans for body text. Dark mode is supported.

Responsive navigation:

- **Desktop:** top navbar.
- **Mobile (< 768px):** floating bottom tab bar with Home · Play · Polls · Placements · Share · Profile.
- Polls shows a badge with the number of open polls you can still answer.
- Both are hidden on live quiz play/presenter screens and the poll live wall.

## Project map

```
app/                 routes (auth, dashboard, profile, quiz, experiences, api)
components/common/   navbar, bottom-tab-bar, footer, podium, cta-pill, user-menu
components/ui/       shadcn primitives (restyled)
features/quiz/       quiz logic + components
features/experiences/placement experiences
features/polls/      Quick Polls + SeatLock, roster, grants, collaborators
features/admin/      role management + audit log
features/landing/    hero illustration
lib/permissions/     RBAC: roles.ts (what roles may do), server.ts (requirePermission)
lib/                 auth, email-policy, navigation, s3, email
db/schema.ts         database schema (Drizzle)
```
