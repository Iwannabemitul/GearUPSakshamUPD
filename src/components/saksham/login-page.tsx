"use client";

/**
 * Saksham Login page.
 *
 * Two-column hero + form layout. Email + password fields plus three demo
 * account buttons (employee / trainer / admin) so a reviewer can poke around
 * without typing. The 10-language switcher sits in the top-right corner and
 * instantly retranslates the whole page.
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { LANGS } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { LoginDialogs } from "@/components/saksham/login-dialogs";

export function LoginPage() {
  const { t, lang, setLang } = useLang();
  const { loginWithEmail, loginDemo } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("demo.officer@gov.in");
  const [password, setPassword] = useState("gov12345");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<null | "employee" | "trainer" | "admin" | "form">(null);

  const doSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError(t("login.errorEmpty"));
      return;
    }
    setBusy("form");
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("login.errorInvalid"));
      setBusy(null);
    }
  };

  const doDemo = async (role: "employee" | "trainer" | "admin") => {
    setError("");
    setBusy(role);
    try {
      await loginDemo(role);
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Hero — left */}
      <section className="relative flex-1 lg:flex-[46%] min-h-[300px] lg:min-h-screen bg-gradient-to-br from-[#0c3483] via-[#1e4a8c] to-[#6b8cce] text-white p-8 lg:p-14 flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(/igot-nobg.png)`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          />
        </div>

        <header className="relative flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Saksham"
            className="w-12 h-12 rounded-full bg-white/95 p-1"
          />
          <div>
            <div className="font-display text-2xl font-bold tracking-tight">
              {t("login.brand")}
            </div>
            <div className="text-sm text-white/80">{t("ui.skillIntelligence")}</div>
          </div>
        </header>

        <div className="relative max-w-md mt-8 lg:mt-0">
          <h1 className="font-display text-3xl lg:text-4xl font-bold leading-tight mb-4 drop-shadow-sm">
            {t("login.heroHeadline")}
          </h1>
          <p className="text-white/90 leading-relaxed">{t("login.heroSubtext")}</p>
        </div>

        {/* About / Privacy / Terms open as modal dialogs (C.2) */}
        <LoginDialogs />
      </section>

      {/* Form — right */}
      <section className="flex-1 lg:flex-[54%] flex items-center justify-center p-6 lg:p-10 bg-[var(--paper)] relative">
        {/* Language switcher */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="text-xs text-[var(--ink-soft)] hidden sm:inline">
            {t("ui.language")}:
          </span>
          <Select value={lang} onValueChange={(v) => setLang(v as typeof lang)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.native} ({l.label})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-display text-3xl font-semibold text-[var(--navy)]">
              {t("login.signIn")}
            </h2>
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              {t("login.prototypeNotice")}
            </p>
          </div>

          <form onSubmit={doSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="text-sm font-medium block mb-1.5">
                {t("login.idLabel")}
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="example@gov.in"
                className="saksham-input"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="text-sm font-medium block mb-1.5">
                {t("login.passwordLabel")}
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="• • • • • •"
                className="saksham-input"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  defaultChecked
                  className="w-4 h-4 accent-[var(--teal)]"
                />
                <span>{t("login.rememberMe")}</span>
              </label>
              <span className="saksham-link">{t("login.forgotPassword")}</span>
            </div>

            {error ? (
              <div
                role="alert"
                className="text-sm text-[var(--critical)] bg-[var(--critical-soft)] border border-[var(--critical)]/20 rounded-lg px-3 py-2"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={busy !== null}
              className="saksham-btn-primary w-full h-11 disabled:opacity-60"
            >
              {busy === "form" ? t("login.signingIn") : t("login.signIn")}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-xs text-[var(--ink-soft)]">
              {t("login.orDemo")}
            </span>
            <div className="h-px flex-1 bg-[var(--line)]" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => doDemo("employee")}
              disabled={busy !== null}
              className="saksham-btn-secondary w-full justify-between h-11 disabled:opacity-60"
            >
              <span>{t("login.employeeDemo")}</span>
              <span>→</span>
            </button>
            <button
              type="button"
              onClick={() => doDemo("trainer")}
              disabled={busy !== null}
              className="saksham-btn-secondary w-full justify-between h-11 disabled:opacity-60"
            >
              <span>{t("login.trainerDemo")}</span>
              <span>→</span>
            </button>
            <button
              type="button"
              onClick={() => doDemo("admin")}
              disabled={busy !== null}
              className="saksham-btn-secondary w-full justify-between h-11 disabled:opacity-60"
            >
              <span>{t("login.adminDemo")}</span>
              <span>→</span>
            </button>
          </div>

          <p className="text-xs text-[var(--ink-soft)] mt-6 leading-relaxed">
            {t("login.credentialNotice")}
          </p>
        </div>
      </section>
    </div>
  );
}
