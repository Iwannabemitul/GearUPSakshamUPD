/**
 * /api/assignments
 *
 * POST — trainer/admin creates an assignment. Trainers may only assign
 *        people inside their own department.
 * GET  — role-scoped list: employees get their own assignments, trainers
 *        get what they authored, admins get everything. `?since=<ISO>`
 *        returns only records created after that instant (offline catch-up).
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";
import { fanout } from "@/lib/fanout";
import { sendEmail } from "@/lib/email";

type PostBody = {
  assigneeId?: string;
  type?: string;
  assessmentId?: string;
  courseId?: string;
  note?: string;
  dueAt?: string;
};

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role === "employee") {
    return jsonError("Only trainers and admins can create assignments", 403);
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const { assigneeId, type } = body;
  if (!assigneeId || !type) {
    return jsonError("assigneeId and type are required", 400);
  }
  const allowedTypes = ["ASSESSMENT", "EXAM", "COURSE", "LEARNING_PATH"];
  if (!allowedTypes.includes(type)) {
    return jsonError(`type must be one of ${allowedTypes.join(", ")}`, 400);
  }
  if (
    (type === "ASSESSMENT" || type === "EXAM") &&
    !body.assessmentId
  ) {
    return jsonError(`${type} assignments require assessmentId`, 400);
  }
  if (type === "COURSE" && !body.courseId) {
    return jsonError("COURSE assignments require courseId", 400);
  }

  const store = getStore();
  const assignee = await store.getUserById(assigneeId);
  if (!assignee) return jsonError("Assignee not found", 404);
  if (
    session.role === "trainer" &&
    assignee.department !== session.department
  ) {
    return jsonError("Trainers can only assign within their department", 403);
  }

  let dueAt: Date | null = null;
  if (body.dueAt) {
    const d = new Date(body.dueAt);
    if (Number.isNaN(d.getTime())) return jsonError("dueAt is not a date", 400);
    dueAt = d;
  }

  const assignment = await store.createAssignment({
    authorId: session.userId,
    assigneeId,
    type: type as "ASSESSMENT" | "EXAM" | "COURSE" | "LEARNING_PATH",
    assessmentId: body.assessmentId ?? null,
    courseId: body.courseId ?? null,
    note: body.note ?? null,
    dueAt,
  });

  void fanout("assignment:created", assignment, [
    `user:${assigneeId}`,
    `dept:${assignee.department ?? "unknown"}`,
  ]);

  // Workstream C.9 — email notification to the assignee (stub; no-op unless
  // EMAIL_ENABLED=true and a provider is configured in src/lib/email.ts).
  void sendEmail({
    to: assignee.email,
    subject: `New assignment: ${assignment.type === "COURSE" ? (assignment.courseId ?? "Course") : (assignment.assessmentId ?? assignment.type)}`,
    body: `${session.name} has assigned you an item on Saksham. Sign in to view and start it.`,
  });

  return Response.json({ assignment }, { status: 201 });
}

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

  const store = getStore();
  let assignments;
  if (session.role === "employee") {
    assignments = await store.listAssignmentsForAssignee(session.userId, since);
  } else if (session.role === "trainer") {
    assignments = await store.listAssignmentsForAuthor(session.userId, since);
  } else {
    assignments = await store.listAllAssignments(since);
  }

  return Response.json({ assignments, now: new Date().toISOString() });
}
