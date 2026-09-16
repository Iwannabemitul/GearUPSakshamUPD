/**
 * Server-side session helper for API routes.
 *
 * Returns the authenticated session (with userId / role / department) or
 * null. Every /api route must call this before touching the Store.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export type AuthedSession = {
  userId: string;
  role: "employee" | "trainer" | "admin";
  department: string | null;
  name: string;
  email: string;
};

export async function getSessionOrNull(): Promise<AuthedSession | null> {
  const session = await getServerSession(authOptions);
  if (!session?.userId || !session.role) return null;
  return {
    userId: session.userId,
    role: session.role,
    department: session.department ?? null,
    name: session.user?.name ?? "",
    email: session.user?.email ?? "",
  };
}

export function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Throws a 401/403 Response when the caller is not authenticated, or when
 * they touch data outside their scope:
 *   - employees: only their own userId
 *   - trainers: only their own department
 *   - admins: everything
 */
export async function requireSession(): Promise<AuthedSession> {
  const s = await getSessionOrNull();
  if (!s) throw jsonError("Unauthorized", 401);
  return s;
}

export function isStaff(role: AuthedSession["role"]): boolean {
  return role === "trainer" || role === "admin";
}
