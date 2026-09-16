# Saksham Skill Intelligence — Master Prompt (Post A+B+C Build)

> **How to use this document:** this is the handoff brief for the NEXT agent
> or developer. It captures the full current state after Workstreams A, B
> and C plus the MongoDB demo backend were built on top of the original
> prototype. Read section 0–2 first, then the "Known issues & debugging
> notes" section before changing anything.

---

## 0. What this project is now

**Saksham Skill Intelligence** — Next.js 16 (App Router) + TypeScript strict
+ Tailwind 4 + shadcn/ui single-route app (`/` only) for Indian government
workforce capacity-building, with:

- **Real persistence** — Prisma + SQLite by default (`prisma/dev.db`),
  or **MongoDB Atlas** opt-in (`DATA_BACKEND=mongo`). Both implement the
  same `Store` interface (`src/lib/store.ts`).
- **Real auth** — NextAuth v4 credentials provider, bcrypt-hashed
  passwords, JWT sessions carrying `userId/role/department`.
- **Real-time sync (Workstream A)** — a socket.io realtime service on port
  **3004** fans out assignments, submissions, competency changes and
  presence between Employees ↔ Trainers ↔ Admins. REST `?since=` endpoints
  cover offline catch-up.
- **Accessibility pass (Workstream B)** — WCAG 2.1 AA: skip link, focus
  rings, high-contrast mode, font-size steps, dark mode, reduced motion,
  keyboard-navigable quiz options, aria-live regions, read-aloud AI.
- **Roadmap items (Workstream C)** — About/Privacy/Terms dialogs, persisted
  quiz history, LLM-backed assessment generator + publish route, PDF
  certificate, admin dept filter, PWA shell, notification center, email
  hook stub, code-split pages, i18n audit tooling.

## 0b. Changelog (post-handoff batch fixes)

Track incremental fixes here as they land, newest first, so the next agent
doesn't have to diff the zip against the previous one.

- **[Batch 1] Proctoring lock widened to cover device-check screen.**
  `src/components/saksham/app-shell.tsx` — the sidebar/logout/language/
  avatar disable-state and the AI widget's visibility used to key off
  `proctor.active` alone, which only becomes `true` once fullscreen is
  entered. That left a window during the camera/mic permission screen
  (`quiz.page === "proctor-check"`) where the dashboard chrome still looked
  interactive and the floating AI widget was still visible, even though
  `PageRouter` was already force-showing the proctor-check content
  underneath. Fixed by widening the `locked` condition:
  ```ts
  const locked =
    proctor.active || quiz.page === "proctor-check" || quiz.page === "quiz";
  ```
  No other files touched. The in-page "Cancel" button on the proctor-check
  screen is unaffected (it's part of that page's own content, not the
  shell chrome) and still lets the user back out before starting.
  Client-side only, by request — no server-side gate was added on the
  AI-service route for this batch (see "Suggested next steps" below if that
  changes).

## 1. Accounts (seeded, bcrypt-hashed)

| Role | Email | Password |
|---|---|---|
| Employee | `demo.officer@gov.in` | `gov12345` |
| Employee | `testificate@test.com` | `12345678` |
| Employee | `hello@test.com` | `hello` |
| Trainer (real, new) | `trainer@test.com` | `trainer123` |
| Admin | `admin@test.com` | `admin` |

Trainer demo button logs in as `trainer@test.com` (Suman Bansal), same
department ("Department of Statistics") as the employees — that is what
trainer-dept scoping keys off.

## 2. How to run (Windows or Linux; Bun preferred, Node 20+ works)

```bash
bun run setup            # ONE COMMAND: installs root + both mini-services, db push + seed
# (or step by step: bun install; bun install --cwd mini-services/ai-service;
#  bun install --cwd mini-services/realtime-service; bun run db:push; bun run db:seed)
bun run db:seed:mongo    # only for the Atlas demo

bun run dev            # app        http://localhost:3000
bun run dev:realtime   # realtime   http://localhost:3004 (auto-installs its deps first)
bun run dev:ai         # AI service http://localhost:3003 (auto-installs its deps first)
```

Env knobs: `NEXT_PUBLIC_AI_URL` / `NEXT_PUBLIC_REALTIME_URL` override the
direct-localhost socket URLs (set them to `/?XTransformPort=3003`-style
gateway URLs only behind the original Caddy setup). `LLM_ENABLED=true` +
provider keys on the ai-service enable real LLM replies/question generation;
otherwise both fall back to deterministic mocks.

## 3. Architecture map

```
src/
├── app/
│   ├── layout.tsx                # ThemeProvider(next-themes) > A11yProvider > LanguageProvider
│   ├── page.tsx                  # Gate: LoginPage vs AppShell (single route!)
│   ├── proxy.ts                  # Next 16 middleware: JWT-decode guard -> 401 on /api/*
│   └── api/
│       ├── auth/[...nextauth]/   # credentials login (bcrypt vs Store)
│       ├── realtime/token/       # short-lived HMAC token for the socket service
│       ├── assignments/…         # POST/GET (+?since=), PATCH /:id
│       ├── assessments/…         # POST (publish generated), /:id/start, /attempts/:id/submit
│       ├── users/me/(bootstrap|attempts)
│       └── trainer/(activity|workforce)   # dept-scoped feed + workforce
├── lib/
│   ├── store.ts                  # Store INTERFACE (the seam)
│   ├── store-prisma.ts           # SQLite adapter (default)
│   ├── store-mongo.ts            # MongoDB adapter (DATA_BACKEND=mongo)
│   ├── seed-source.ts            # normalises the 5 JSON files for both seeds
│   ├── auth-options.ts / auth.ts # NextAuth config + requireSession()
│   ├── auth-context.tsx          # wraps useSession, keeps old {session,data,login*,logout} API
│   ├── realtime-context.tsx      # socket client, token rotation, ?since= catch-up, useRealtimeEvent()
│   ├── assignments-context.tsx   # client assignment list + optimistic status updates
│   ├── a11y-context.tsx          # high-contrast/font-step state + A11yToolbar
│   ├── scoring.ts                # server-authoritative scoring + level heuristic
│   ├── fanout.ts                 # API routes -> realtime service /fanout (HMAC secret)
│   ├── email.ts                  # C.9 stub (EMAIL_ENABLED gate)
│   ├── certificate.ts            # C.5 pdf-lib completion certificate
│   └── i18n/                     # 10 dicts spreading en; hi is 100% complete
├── components/saksham/
│   ├── app-shell.tsx             # sidebar/topbar/PageRouter (pages loaded via next/dynamic — C.10)
│   ├── login-page.tsx / login-dialogs.tsx      # C.2 About/Privacy/Terms dialogs
│   ├── assignments-section.tsx   # employee "My Assignments" (live slide-in)
│   ├── activity-feed.tsx         # trainer/admin live feed
│   ├── assign-dialog.tsx         # trainer "Assign to Employee"
│   ├── notification-center.tsx   # C.8 topbar bell
│   ├── ai-widget.tsx             # focus trap, aria-live, read-aloud (speechSynthesis)
│   ├── quiz-context.tsx          # begins attempt via API, submits for server re-scoring,
│   │                             #   hydrates history from /api/users/me/attempts (C.3)
│   └── pages/{employee,trainer,admin,quiz,result,proctor-check}.tsx
prisma/schema.prisma              # User/Competency/AssessmentMeta/Question/AssessmentAttempt/Assignment/Session
prisma/seed.ts                    # idempotent SQLite seed
scripts/
├── seed-mongo.ts                 # idempotent Mongo seed
├── e2e-workstream-a.mjs          # 19-assertion cross-role API/realtime test
├── test-realtime.ts              # token+subscribe+fanout smoke test
├── i18n-audit.js                 # coverage report -> docs/i18n-coverage.md
├── make-zip.js                   # scrubbed deliverable ZIP (excludes .env/db/logs)
└── verify-zip.ps1                # proves the ZIP has no secrets
mini-services/
├── ai-service/index.ts           # :3003  ai_respond + generate_assessment (LLM/mock)
└── realtime-service/index.ts     # :3004  channels, presence, /fanout, HMAC tokens
docs/                             # i18n coverage, native-speaker checklist, email notes
```

## 4. Data & sync model (quick reference)

- Channel model: `user:<id>`, `role:trainer|admin|employee`, `dept:<name>`.
  The client fetches `/api/realtime/token` (10-min HMAC), subscribes with
  it, pings every 25s; the service verifies channels against the token
  identity. API routes persist via the Store, then POST the realtime
  service's `/fanout` (shared `FANOUT_SECRET`).
- Scoring: the client shows its local result immediately, but the server
  re-scores the submitted indices against the stored bank, applies the
  level heuristic (≥70 → +1, <30 → −1, clamp 1–5), updates competencies,
  auto-completes matching assignments, and fans out. Result page shows
  "Your trainer has been notified" when the server round-trip succeeded.
- Role scoping: employees see only their own data; trainers only their
  department; admins everything. Enforced in every route + e2e-tested.

## 5. Verification toolkit

```bash
bun run lint                                   # must be 0 problems
bunx tsc --noEmit                              # must be 0 errors
node scripts/e2e-workstream-a.mjs              # full cross-role chain
bun scripts/test-realtime.ts                   # needs realtime service up
node scripts/i18n-audit.js                     # coverage report
node scripts/make-zip.js && powershell -File scripts/verify-zip.ps1
```

Browser golden path: login (employee) → dashboard shows My Assignments →
trainer in a second browser assigns "SQL Skill Assessment" → appears <2s →
Start → proctor check → answer → submit → result (score + level + trainer
notified) → trainer's dashboard feed shows the submission.

## 6. Known issues & debugging notes

1. **Radix dialog close could stick as a blank box (FIXED — regression risk).**
   Symptom: closing the About/Privacy/Terms dialog left a transparent
   `data-state="closed"` dialog mounted forever. Root cause: Radix Presence
   waits for the exit animation's `animationend`, which never fires under
   this Tailwind-4 + tw-animate-css setup. Two-layer fix in place:
   (a) `globals.css` ends with a `[data-state="closed"] { animation: none
   !important; transition: none !important }` guard, and (b)
   `login-dialogs.tsx` conditionally renders the whole `<Dialog>` Root so
   closing unmounts the portal outright. If you add NEW dialogs, prefer the
   conditional-Root pattern (`{open ? <Dialog open …> : null}`) over
   `open={bool}` to stay immune.
2. **Playwright-style trusted clicks on this app's buttons can time out in
   automation** (hit-target actionability) while real user clicks work.
   In tests, prefer `locator.evaluate(el => el.click())` or `force: true`.
3. **next-auth v4 on Next 16**: middleware (`withAuth`) 307-redirects
   instead of 401-ing APIs; that's why `src/proxy.ts` decodes the JWT
   directly. If you upgrade next-auth, re-test the 401 path.
4. **Socket URLs**: local runs connect directly to :3003/:3004 (CORS on).
   The original Caddy `?XTransformPort=` gateway mode is restorable via
   `NEXT_PUBLIC_AI_URL` / `NEXT_PUBLIC_REALTIME_URL`.
5. **Two `next dev` instances cannot share `.next`** (lock file). Stop one,
   delete `.next/dev/lock`, restart. Port stuck? `netstat -ano | grep :3000`
   then `taskkill //F //PID <pid>` (Windows).
6. **Mini-service deps are per-folder**: `mini-services/ai-service` and
   `mini-services/realtime-service` each have their own `package.json` —
   `bun install` at the root does NOT cover them. `bun run setup` handles
   everything, and `dev:realtime`/`dev:ai` auto-install first. If you see
   `Cannot find package 'socket.io'`, run `bun install --cwd
   mini-services/realtime-service` (or ai-service).
6b. **i18n**: en + hi are complete. The other 8 languages fall back to
   English for ~39 keys each — the queue + review checklist live in
   `docs/native-speaker-audit-checklist.md` and `docs/i18n-coverage.md`.
7. **AI/LLM**: with `LLM_ENABLED=false` (default) the chat uses local QA
   banks and `generate_assessment` returns deterministic template
   questions (`source: "mock"`). Real generation needs provider keys in
   `mini-services/ai-service/.env` (see its `.env.example`).
8. **Email (C.9)**: `src/lib/email.ts` is a logged no-op unless
   `EMAIL_ENABLED=true` AND a provider block is filled in — see
   `docs/email-notifications.md`.
9. **Mongo demo**: needs internet + IP allowlist on Atlas. `db:seed:mongo`
   is idempotent and never overwrites real attempts. Verify with a second
   server: `DATA_BACKEND=mongo bun next dev -p 3001` (only one `next dev`
   can own `.next` at a time — see issue 5).
10. **Pre-existing quirks fixed during the build** (don't reintroduce):
    duplicate i18n keys (`proctorChecking`/`proctorWarnings` ×10 files),
    `proctor.toast()` miscall in app-shell (real crash), malformed generic
    in trainer.tsx, `tFor` missing imports in i18n/index.ts, `webkitRequestFullscreen` typing.

## 7. Suggested next steps (priority order)

1. **Pilot hardening** — axe-core sweep on every page; real NVDA + Firefox
   manual pass (B checklist); test on an actual phone over LAN.
2. **Translation completion** — clear the 8-language queue via
   `docs/native-speaker-audit-checklist.md`.
3. **LLM keys** — wire OpenRouter/OpenAI credentials and regenerate real
   question banks; add a trainer review step before publishing.
4. **Email provider** — fill the Resend/SES block (`docs/email-notifications.md`).
5. **Deployment** — the app expects all three ports reachable; front it
   with the original Caddy (or any proxy) and set the `NEXT_PUBLIC_*_URL`
   overrides accordingly. `EMAIL_ENABLED`, `LLM_ENABLED` stay off by default.
6. **(Open, deferred from Batch 1) Server-side proctoring gate** — the
   AI-service route (`mini-services/ai-service/index.ts`) currently has no
   awareness of proctor/quiz state, so a request crafted directly against
   `:3003` (bypassing the UI) would still get a response while an
   assessment is "locked" client-side. Not done in Batch 1 by explicit
   request (client-side hiding was deemed sufficient for the demo) — worth
   revisiting before any real pilot, e.g. by having the client pass the
   active attempt id/proctor token and having the service refuse/queue
   while that attempt is open.

## 8. Hard constraints (still in force)

Next 16 App Router; TypeScript strict, no new `any`; shadcn/ui; Tailwind 4;
govt-modern palette; socket.io for realtime; single route `/` (modals, not
routes); scripts persisted under `scripts/`; deliverables under `download/`;
`bun run lint` clean before done; new UI strings minimum `en.ts` + `hi.ts`;
ZIP must be regenerated via `scripts/make-zip.js` and verified scrubbed
(it excludes `.env`, `dev.db`, `node_modules`, logs — never ship secrets).

---
**End of master prompt.** Start with section 6 (known issues) before
debugging, then section 5 (verification toolkit) to establish a green
baseline before making changes.
