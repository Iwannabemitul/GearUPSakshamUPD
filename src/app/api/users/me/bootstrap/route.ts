/**
 * /api/users/me/bootstrap — identity + competencies + recent attempts +
 * assignments for the signed-in user. The client merges this over the
 * JSON-built app data so dashboards reflect persisted state after login or
 * reconnect.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const store = getStore();
  const [user, competencies, attempts, assignments] = await Promise.all([
    store.getUserById(session.userId),
    store.getCompetencies(session.userId),
    store.listAttemptsByUser(session.userId),
    session.role === "employee"
      ? store.listAssignmentsForAssignee(session.userId)
      : session.role === "trainer"
        ? store.listAssignmentsForAuthor(session.userId)
        : store.listAllAssignments(),
  ]);

  return Response.json({
    user: user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          designation: user.designation,
          department: user.department,
          organization: user.organization,
          location: user.location,
          yearsOfService: user.yearsOfService,
          reportsTo: user.reportsTo,
        }
      : null,
    competencies,
    attempts,
    assignments,
    serverNow: new Date().toISOString(),
  });
}
