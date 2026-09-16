"use client";

/**
 * A11yProvider — accessibility preference center (Workstream B).
 *
 * Owns two persisted display preferences and exposes a topbar toolbar:
 *   - High-contrast mode: toggles the `.high-contrast` class on <html>,
 *     switching the palette to black/white/blue/yellow with thick borders.
 *   - Font size: five root steps (14 / 16 / 18 / 20 / 22 px) via
 *     data-font-step on <html>; every rem-based token follows.
 *
 * Dark mode is owned by next-themes (ThemeToggle below) and wired to the
 * existing `.dark` token set.
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
import { useTheme } from "next-themes";
import { Contrast, Moon, Sun, Type } from "lucide-react";

const LS_CONTRAST = "saksham.highContrast";
const LS_FONT_STEP = "saksham.fontStep";

type A11yContextValue = {
  highContrast: boolean;
  toggleHighContrast: () => void;
  fontStep: number;
  stepFont: (delta: number) => void;
};

const A11yContext = createContext<A11yContextValue | null>(null);

export function A11yProvider({ children }: { children: ReactNode }) {
  const [highContrast, setHighContrast] = useState(false);
  const [fontStep, setFontStep] = useState(1);

  // Hydrate from localStorage after mount (hydration-safe).
  useEffect(() => {
    try {
      const hc = localStorage.getItem(LS_CONTRAST) === "1";
      const step = Number(localStorage.getItem(LS_FONT_STEP) ?? "1");
      if (hc) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHighContrast(true);
      }
      if (!Number.isNaN(step) && step >= 0 && step <= 4) {
         
        setFontStep(step);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Reflect preferences onto <html> (external system — effect is correct).
  useEffect(() => {
    const el = document.documentElement;
    el.classList.toggle("high-contrast", highContrast);
    el.dataset.fontStep = String(fontStep);
  }, [highContrast, fontStep]);

  const toggleHighContrast = useCallback(() => {
    setHighContrast((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LS_CONTRAST, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const stepFont = useCallback((delta: number) => {
    setFontStep((prev) => {
      const next = Math.max(0, Math.min(4, prev + delta));
      try {
        localStorage.setItem(LS_FONT_STEP, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ highContrast, toggleHighContrast, fontStep, stepFont }),
    [highContrast, toggleHighContrast, fontStep, stepFont],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y(): A11yContextValue {
  const ctx = useContext(A11yContext);
  if (!ctx) {
    throw new Error("useA11y must be used inside <A11yProvider>");
  }
  return ctx;
}

const FONT_LABELS = ["A−", "A", "A+", "A++", "A+++"];

/** Topbar accessibility toolbar: font size, contrast, dark mode. */
export function A11yToolbar() {
  const { highContrast, toggleHighContrast, fontStep, stepFont } = useA11y();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div
      className="flex items-center gap-1"
      role="group"
      aria-label="Accessibility controls"
    >
      <button
        type="button"
        onClick={() => stepFont(-1)}
        disabled={fontStep === 0}
        aria-label="Decrease text size"
        title="Decrease text size"
        className="h-9 min-w-[36px] px-1.5 rounded-md border border-[var(--line)] text-xs font-semibold grid place-items-center hover:border-[var(--teal)] disabled:opacity-40 transition"
      >
        A−
      </button>
      <span
        className="text-xs text-[var(--ink-soft)] w-9 text-center tabular-nums"
        aria-live="polite"
      >
        <Type size={12} className="inline mr-0.5" />
        {FONT_LABELS[fontStep] ?? "A"}
      </span>
      <button
        type="button"
        onClick={() => stepFont(1)}
        disabled={fontStep === 4}
        aria-label="Increase text size"
        title="Increase text size"
        className="h-9 min-w-[36px] px-1.5 rounded-md border border-[var(--line)] text-sm font-semibold grid place-items-center hover:border-[var(--teal)] disabled:opacity-40 transition"
      >
        A+
      </button>

      <button
        type="button"
        onClick={toggleHighContrast}
        aria-pressed={highContrast}
        aria-label="Toggle high contrast mode"
        title="High contrast mode"
        className={`h-9 w-9 rounded-md border grid place-items-center transition ${
          highContrast
            ? "bg-[var(--navy)] text-white border-[var(--navy)]"
            : "border-[var(--line)] hover:border-[var(--teal)]"
        }`}
      >
        <Contrast size={16} />
      </button>

      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-pressed={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
        className="h-9 w-9 rounded-md border border-[var(--line)] grid place-items-center hover:border-[var(--teal)] transition"
      >
        {mounted ? (
          isDark ? (
            <Sun size={16} />
          ) : (
            <Moon size={16} />
          )
        ) : (
          <Moon size={16} />
        )}
      </button>
    </div>
  );
}
