"use client";

/**
 * Saksham Skill Intelligence — root page.
 *
 * Single Next.js route (`/`) that handles the entire app. Auth state decides
 * whether to show the Login screen or the AppShell. Inside the shell we
 * switch pages locally with React state (employee / trainer / admin) so the
 * user can navigate without round-trips.
 */

import { useState } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginPage } from "@/components/saksham/login-page";
import { AppShell } from "@/components/saksham/app-shell";
import { ProctorProvider } from "@/components/saksham/proctor-context";

function Gate() {
  const { session, data } = useAuth();

  if (!session || !data) return <LoginPage />;

  return (
    <ProctorProvider>
      <AppShell />
    </ProctorProvider>
  );
}

export default function Home() {
  // Force a re-render when needed by toggling state — currently just a passthrough.
  const [, _] = useState(0);
  void _;

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
