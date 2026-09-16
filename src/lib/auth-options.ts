/**
 * NextAuth configuration (server-side only).
 *
 * Credentials provider validates against the Store (Prisma/SQLite by
 * default, MongoDB when DATA_BACKEND=mongo) with bcrypt password hashes.
 * JWT strategy — no database sessions. The JWT + session carry the user's
 * id, role and department so API routes can scope access without extra
 * queries.
 */

import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getStore } from "@/lib/store";

export function appRoleOf(storeRole: string): "employee" | "trainer" | "admin" {
  if (storeRole === "TRAINER") return "trainer";
  if (storeRole === "ADMIN") return "admin";
  return "employee";
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  pages: { signIn: "/" },
  providers: [
    CredentialsProvider({
      name: "Government of Punjab SSO (demo)",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;
        if (!email || !password) return null;

        const store = getStore();
        const user = await store.getUserByEmail(email);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.department = user.department;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name ?? session.user.name;
        session.user.email = token.email ?? session.user.email;
      }
      session.userId = (token.uid as string) ?? "";
      session.role = appRoleOf((token.role as string) ?? "EMPLOYEE");
      session.department = (token.department as string | null) ?? null;
      return session;
    },
  },
};
