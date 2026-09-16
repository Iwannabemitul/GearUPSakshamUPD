/**
 * /api/trainer/activity — live activity feed.
 * Trainers see events for their department; admins see everything.
 * Currently surfaced events: submitted attempts (score + level change) and
 * assignment completions, merged chronologically. `?since=<ISO>` supported.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role === "employee") {
    return jsonError("Employees have no activity feed", 403);
  }

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get("since");
  let since: Date | undefined;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (!Number.isNaN(d.getTime())) since = d;
  }

  const store = getStore();
  const department = session.role === "trainer" ? session.department : null;

  const [attempts, assignments] = await Promise.all([
    store.listSubmittedAttempts({ since, department, limit: 50 }),
    department
      ? store.listAssignmentsForAuthor(session.userId, since)
      : store.listAllAssignments(since),
  ]);

  type FeedItem = {
    kind: string;
    at: string;
    [key: string]: unknown;
  };

  const items: FeedItem[] = [];

  for (const a of attempts) {
    items.push({
      kind: "assessment:submitted",
      at: (a.submittedAt ?? a.startedAt).toISOString(),
      attemptId: a.id,
      userId: a.userId,
      userName: a.userName,
      assessmentTitle: a.assessmentTitle,
      assessmentCompetency: a.assessmentCompetency,
      assessmentExternalId: a.assessmentExternalId,
      score: a.score,
      prevLevel: a.prevLevel,
      newLevel: a.newLevel,
      terminatedReason: a.terminatedReason,
    });
  }
  for (const a of assignments) {
    if (a.status === "COMPLETED" && a.completedAt) {
      items.push({
        kind: "assignment:completed",
        at: a.completedAt.toISOString(),
        assignmentId: a.id,
        userId: a.assigneeId,
        userName: a.assigneeName,
        title: a.type === "COURSE" ? a.courseId : a.assessmentId,
        type: a.type,
      });
    } else {
      items.push({
        kind: "assignment:created",
        at: a.createdAt.toISOString(),
        assignmentId: a.id,
        userId: a.assigneeId,
        userName: a.assigneeName,
        title: a.type === "COURSE" ? a.courseId : a.assessmentId,
        type: a.type,
        status: a.status,
      });
    }
  }

  items.sort((x, y) => (x.at < y.at ? 1 : -1));

  return Response.json({
    items: items.slice(0, 50),
    now: new Date().toISOString(),
  });
}
