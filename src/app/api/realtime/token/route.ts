/**
 * /api/realtime/token — mints a short-lived HMAC-signed token the realtime
 * service (port 3004) can verify without access to the NextAuth JWE secret.
 *
 * Token shape: base64url(payload JSON) + "." + hex(HMAC-SHA256(payload, FANOUT_SECRET))
 * payload: { uid, role, dept, exp } — exp is 10 minutes ahead.
 * The client re-fetches this and re-subscribes before expiry.
 */

import { createHmac } from "node:crypto";
import { getSessionOrNull, jsonError } from "@/lib/auth";

function b64url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const secret = process.env.FANOUT_SECRET;
  if (!secret) return jsonError("Realtime not configured", 503);

  const payload = {
    uid: session.userId,
    role: session.role,
    dept: session.department ?? "",
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", secret).update(body).digest("hex");

  return Response.json({
    token: `${body}.${sig}`,
    userId: session.userId,
    role: session.role,
    department: session.department,
    socketUrl:
      process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:3004",
  });
}
