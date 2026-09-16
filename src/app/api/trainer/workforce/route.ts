/**
 * /api/trainer/workforce — department employees with competencies, online
 * presence is resolved client-side (realtime service), attempts summary.
 * Trainers: own department. Admins: all departments.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";

export async function GET() {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role === "employee") {
    return jsonError("Employees have no workforce view", 403);
  }

  const store = getStore();
  const department =
    session.role === "trainer" ? session.department : null;

  const users = department
    ? await store.listUsersByDepartment(department)
    : await store.listUsers();

  const workforce = await Promise.all(
    users
      .filter((u) => u.role === "EMPLOYEE" || u.role === "TRAINER")
      .map(async (u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        designation: u.designation,
        department: u.department,
        role: u.role,
        competencies: await store.getCompetencies(u.id),
      })),
  );

  return Response.json({
    workforce,
    department: department ?? "All departments",
    now: new Date().toISOString(),
  });
}
