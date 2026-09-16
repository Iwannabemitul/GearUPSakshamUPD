/**
 * Email notification hook (Workstream C.9 — stub).
 *
 * The platform fires `sendEmail` at the two moments the brief identifies:
 *   1. A trainer assigns something        -> notify the employee
 *   2. An employee submits an assessment  -> notify the trainer(s)
 *
 * This build ships the hook WITHOUT a provider: with EMAIL_ENABLED!=true the
 * function logs and returns immediately, so no credentials are needed. To
 * enable, install a provider SDK (e.g. `resend`), set
 * EMAIL_ENABLED=true and RESEND_API_KEY=..., and fill in the marked block.
 * Delivery is fire-and-forget; failures never block API responses.
 */

export type EmailPayload = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(payload: EmailPayload): Promise<void> {
  if (process.env.EMAIL_ENABLED !== "true") return;
  // === PROVIDER BLOCK (fill in when enabling email delivery) ===
  // Example with Resend:
  //   const { Resend } = await import("resend");
  //   const resend = new Resend(process.env.RESEND_API_KEY);
  //   await resend.emails.send({
  //     from: "Saksham <noreply@saksham.gov.in>",
  //     to: payload.to,
  //     subject: payload.subject,
  //     text: payload.body,
  //   });
  console.log(
    `[email] EMAIL_ENABLED=true but no provider is configured — dropped mail to ${payload.to}: ${payload.subject}`,
  );
}
