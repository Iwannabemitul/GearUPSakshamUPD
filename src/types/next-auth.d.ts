import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /** Saksham user id (Store id). */
    userId: string;
    /** Lowercase app role used by the UI: employee | trainer | admin. */
    role: "employee" | "trainer" | "admin";
    /** User's department, used for trainer scoping. */
    department: string | null;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  }

  interface User {
    role?: string;
    department?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: string;
    department?: string | null;
  }
}
