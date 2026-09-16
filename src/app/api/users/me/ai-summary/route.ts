/**
 * /api/users/me/ai-summary — the signed-in user's cached AI profile summary.
 *
 * Always returns the last cached value (generated after their most recent
 * assessment submission); never calls the LLM live. `null` summary means
 * none has been generated yet (e.g. no submissions, or ai-service was
 * unreachable at submit time).
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const store = getStore();
  const summary = await store.getAiProfileSummary(session.userId);
  return Response.json({ summary });
}
