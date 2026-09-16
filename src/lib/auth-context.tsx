"use client";

/**
 * AuthProvider — server-backed auth with the prototype's client shape.
 *
 * Login now round-trips through NextAuth (`/api/auth/[...nextauth]`) which
 * validates bcrypt hashes against the Store (SQLite default, Mongo optional)
 * and issues a signed JWT cookie. The public API keeps the prototype's
 * `{ session, data, loginWithEmail, loginDemo, logout }` shape so the rest of
 * the app is unchanged; only the two login entry points became async.
 *
 * The localStorage mirror (`saksham.session/email/username`) is kept as an
 * optimistic hydration cache so a refresh doesn't flash the login screen
 * while the JWT session is being fetched. If the mirror disagrees with the
 * server session, the server wins.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SessionProvider, signIn, signOut, useSession } from "next-auth/react";
import { buildAppData, type AppData, type Role } from "@/lib/data";

type Session = {
  email: string;
  name: string;
  role: Role;
};

type AuthContextValue = {
  session: Session | null;
  data: AppData | null;
  loginWithEmail: (email: string, password: string) => Promise<Session>;
  loginDemo: (role: Role) => Promise<Session>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LS_SESSION = "saksham.session";
const LS_EMAIL = "saksham.email";
const LS_NAME = "saksham.username";

const DEMO_CREDENTIALS: Record<Role, { email: string; password: string }> = {
  employee: { email: "demo.officer@gov.in", password: "gov12345" },
  trainer: { email: "trainer@test.com", password: "trainer123" },
  admin: { email: "admin@test.com", password: "admin" },
};

function readMirror(): Session | null {
  try {
    const email = localStorage.getItem(LS_EMAIL);
    const name = localStorage.getItem(LS_NAME);
    const role = localStorage.getItem(LS_SESSION) as Role | null;
    if (email && role && ["employee", "trainer", "admin"].includes(role)) {
      return { email, name: name ?? email, role };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function writeMirror(s: Session) {
  try {
    localStorage.setItem(LS_EMAIL, s.email);
    localStorage.setItem(LS_NAME, s.name);
    localStorage.setItem(LS_SESSION, s.role);
  } catch {
    /* ignore */
  }
}

function clearMirror() {
  try {
    localStorage.removeItem(LS_EMAIL);
    localStorage.removeItem(LS_NAME);
    localStorage.removeItem(LS_SESSION);
  } catch {
    /* ignore */
  }
}

function AuthProviderInner({ children }: { children: ReactNode }) {
  // next-auth session — status is "loading" until the JWT cookie is checked.
  const { data: naSession, status } = useSession();

  // IMPORTANT: hydrate optimistically from the localStorage mirror first
  // (avoids the login-screen flash on refresh), then let the server session
  // take precedence once it resolves.
  const [optimistic, setOptimistic] = useState<Session | null>(null);

  useEffect(() => {
    const mirror = readMirror();
    if (mirror) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOptimistic(mirror);
    }
  }, []);

  const serverSession: Session | null = useMemo(() => {
    if (status !== "authenticated" || !naSession?.user) return null;
    return {
      email: naSession.user.email ?? "",
      name: naSession.user.name ?? "",
      role: naSession.role ?? "employee",
    };
  }, [naSession, status]);

  const session = serverSession ?? (status === "loading" ? optimistic : null);

  // The data bundle is DERIVED from the session (no state, no effect): the
  // heavy catalog comes from the JSON snapshot, identity fields are only
  // used for display. Server truth (competencies, history) is merged in by
  // the bootstrap consumers downstream.
  const sessionEmail = session?.email ?? null;
  const sessionRole = session?.role ?? null;
  const data = useMemo<AppData | null>(
    () =>
      sessionEmail && sessionRole
        ? buildAppData(sessionRole, sessionEmail)
        : null,
    [sessionEmail, sessionRole],
  );

  // Keep the localStorage mirror in step with the server session (external
  // system write — allowed in effects).
  useEffect(() => {
    if (!serverSession) return;
    const mirror = readMirror();
    if (
      !mirror ||
      mirror.email !== serverSession.email ||
      mirror.role !== serverSession.role
    ) {
      writeMirror(serverSession);
    }
  }, [serverSession]);

  const fetchServerSession = useCallback(async (): Promise<Session | null> => {
    try {
      const res = await fetch("/api/auth/session");
      if (!res.ok) return null;
      const s = (await res.json()) as {
        user?: { name?: string | null; email?: string | null } | null;
        role?: Role;
      } | null;
      if (!s?.user?.email || !s.role) return null;
      return {
        email: s.user.email,
        name: s.user.name ?? s.user.email,
        role: s.role,
      };
    } catch {
      return null;
    }
  }, []);

  const loginWithEmail = useCallback(
    async (email: string, password: string): Promise<Session> => {
      const res = await signIn("credentials", {
        redirect: false,
        email: email.toLowerCase().trim(),
        password,
      });
      if (!res || res.error || res.status !== 200) {
        throw new Error("Invalid credentials. Try the demo accounts below.");
      }
      const s = (await fetchServerSession()) ?? {
        email: email.toLowerCase().trim(),
        name: email.toLowerCase().trim(),
        role: "employee" as Role,
      };
      writeMirror(s);
      setOptimistic(s);
      return s;
    },
    [fetchServerSession],
  );

  const loginDemo = useCallback(
    async (role: Role): Promise<Session> => {
      const creds = DEMO_CREDENTIALS[role];
      const res = await signIn("credentials", {
        redirect: false,
        email: creds.email,
        password: creds.password,
      });
      if (!res || res.error || res.status !== 200) {
        throw new Error("Demo login failed. Is the server running?");
      }
      const s = (await fetchServerSession()) ?? {
        email: creds.email,
        name: creds.email,
        role,
      };
      writeMirror(s);
      setOptimistic(s);
      return s;
    },
    [fetchServerSession],
  );

  const logout = useCallback(() => {
    setOptimistic(null);
    clearMirror();
    void signOut({ redirect: false });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, data, loginWithEmail, loginDemo, logout }),
    [session, data, loginWithEmail, loginDemo, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </SessionProvider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
