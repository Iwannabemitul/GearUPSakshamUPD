/**
 * /api/users/me/attempts — the signed-in user's submitted attempts.
 * `?since=<ISO>` for offline catch-up.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  let since: Date | undefined;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const attempts = await getStore().listAttemptsByUser(session.userId, since);
  return Response.json({ attempts, now: new Date().toISOString() });
}
