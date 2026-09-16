/**
 * /api/users/:id/ai-summary — cached AI profile summary for a specific
 * employee, scoped the same way as the rest of the app:
 *   - employees: only their own id
 *   - trainers: only employees in their own department
 *   - admins: anyone
 *
 * Always returns the last cached value; never calls the LLM live.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;
  const store = getStore();

  if (session.role === "employee") {
    if (id !== session.userId) {
      return jsonError("Employees may only view their own AI summary", 403);
    }
  } else if (session.role === "trainer") {
    const target = await store.getUserById(id);
    if (!target || target.department !== session.department) {
      return jsonError("Not in your department", 403);
    }
  }
  // admins: no additional scoping

  const summary = await store.getAiProfileSummary(id);
  return Response.json({ summary });
}
