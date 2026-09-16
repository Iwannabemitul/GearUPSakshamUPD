/**
 * Next.js 16 route guard (the former middleware.ts).
 *
 * Decodes the NextAuth session JWT directly (edge runtime) and returns a
 * proper 401 for unauthenticated requests to protected /api/* segments.
 * Route handlers additionally enforce role scoping — this is the outer gate.
 */

import { NextResponse, type NextRequest } from "next/server";
import { decode } from "next-auth/jwt";

const PROTECTED = [
  "/api/assignments",
  "/api/assessments",
  "/api/users",
  "/api/trainer",
];

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookieName = req.cookies.has("__Secure-next-auth.session-token")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
  const raw = req.cookies.get(cookieName)?.value;
  if (raw) {
    try {
      const token = await decode({
        token: raw,
        secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "",
      });
      if (token) return NextResponse.next();
    } catch {
      /* fall through to 401 */
    }
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export const config = {
  matcher: [
    "/api/assignments/:path*",
    "/api/assessments/:path*",
    "/api/users/:path*",
    "/api/trainer/:path*",
  ],
};
