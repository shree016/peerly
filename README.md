# Peeerly

Peeerly is a student platform with three core features:

| Feature | Routes |
| --- | --- |
| **Login / Sign-up** (email + password, Google; Better Auth) | `/auth/login`, `/auth/signup` |
| **Live Quiz** (admin builder, live presenter, play by join code, analytics, PDF reports) | `/quiz`, `/quiz/join`, `/quiz/play/[id]` |
| **Placement Experiences** (share, browse, rounds, JD/resources, Q&A, coordinator verify) | `/experiences` |

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
- `QUIZ_ADMIN_EMAILS`: extra quiz admins as a comma-separated list. The default coordinators are built in.

### 2. Database

1. Create a Neon project and put its URL in `DATABASE_URL`.
2. Create the tables:
   ```bash
   npm run db:migrate   # applies drizzle/0000_peerly_init.sql
   ```

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
```

## Theme

The design tokens live in `app/globals.css`:

- Periwinkle `primary`
- Brand accents `sky`, `sun`, `candy`, `mint` and `ink`, available as Tailwind classes (`bg-sun-soft`, `bg-ink`, …)
- Helpers: `peeerly-card`, `peeerly-chip`, `peeerly-rays`

Fonts are Poppins for headings (via `font-serif`) and Plus Jakarta Sans for body text. Dark mode is supported.

Responsive navigation:

- **Desktop:** top navbar.
- **Mobile (< 768px):** floating bottom tab bar with Home · Play · Placements · Share · Profile.
- Both are hidden on live quiz play/presenter screens.

## Project map

```
app/                 routes (auth, dashboard, profile, quiz, experiences, api)
components/common/   navbar, bottom-tab-bar, footer, podium, cta-pill, user-menu
components/ui/       shadcn primitives (restyled)
features/quiz/       quiz logic + components
features/experiences/placement experiences
features/landing/    hero illustration
lib/                 auth, email-policy, navigation, s3, email
db/schema.ts         database schema (Drizzle)
```
