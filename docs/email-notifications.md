# Email notifications (Workstream C.9 — hook implemented, provider optional)

## What is wired

`src/lib/email.ts` exposes `sendEmail({ to, subject, body })`. It is called
fire-and-forget from:

- **Trainer assigns something** → `POST /api/assignments` emails the assignee
  ("New assignment: …").

The brief's second trigger (employee submits → email the trainer) needs the
trainer's email address resolution from the assignment's author record at the
submit route; the submission route already knows the assignment author when an
assignment auto-completes — add a second `sendEmail` call there once a
provider exists.

## Enabling delivery (no credentials are needed to run without it)

1. `npm install resend` (or the AWS SES SDK of your choice).
2. In `.env`:
   ```
   EMAIL_ENABLED=true
   RESEND_API_KEY=re_xxxxxxxxxxxx
   ```
3. Fill in the marked PROVIDER BLOCK in `src/lib/email.ts`.
4. Restart. Every call site already awaits nothing (fire-and-forget), so
   failures only log — API responses are never blocked by email delivery.

With `EMAIL_ENABLED` unset (the default), calls log to stdout and exit —
safe for demos and tests.
