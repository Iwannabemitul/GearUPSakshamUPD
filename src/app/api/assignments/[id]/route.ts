/**
 * /api/assignments/:id  — PATCH status transitions.
 * Assignee may START/COMPLETE their own assignment; the author (trainer)
 * may also update (e.g. mark EXPIRED). Everyone else gets 403.
 */

import { getStore, type StoreAssignmentStatus } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";
import { fanout } from "@/lib/fanout";

const VALID_STATUSES: StoreAssignmentStatus[] = [
  "PENDING",
  "STARTED",
  "COMPLETED",
  "EXPIRED",
];

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const status = body.status as StoreAssignmentStatus | undefined;
  if (!status || !VALID_STATUSES.includes(status)) {
    return jsonError(`status must be one of ${VALID_STATUSES.join(", ")}`, 400);
  }

  const store = getStore();
  const assignment = await store.getAssignment(id);
  if (!assignment) return jsonError("Assignment not found", 404);

  const involved =
    assignment.assigneeId === session.userId ||
    assignment.authorId === session.userId;
  if (!involved && session.role !== "admin") {
    return jsonError("Forbidden", 403);
  }

  const updated = await store.updateAssignment(id, {
    status,
    completedAt: status === "COMPLETED" ? new Date() : null,
  });

  void fanout("assignment:updated", updated, [
    `user:${updated.assigneeId}`,
    `user:${updated.authorId}`,
  ]);

  return Response.json({ assignment: updated });
}
