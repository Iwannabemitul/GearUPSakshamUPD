"use client";

/**
 * LanguageProvider — React context for client-side language switching.
 *
 * Persists the selected language to localStorage and exposes a `t()` function
 * bound to the current language. Components consume it via `useT()`.
 *
 * Per the user's clarification ("Both"), the AI Assistant exposes its own
 * independent per-chat language override (`aiReplyLang`) so users can keep
 * the UI in English while asking the AI to reply in e.g. Tamil. The AI
 * language defaults to "auto" (follow UI language) until the user picks one.
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
import {
  DEFAULT_LANG,
  interpolate,
  LANGS,
  resolveKey,
  DICTS,
  type Dict,
  type LangCode,
  type TFn,
} from "@/lib/i18n";

type AiLang = LangCode | "auto";

type LangContextValue = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  aiReplyLang: AiLang;
  setAiReplyLang: (l: AiLang) => void;
  resolvedAiLang: LangCode; // aiReplyLang === "auto" ? lang : aiReplyLang
  t: TFn;
  dict: Dict;
};

const LangContext = createContext<LangContextValue | null>(null);

const LS_LANG = "saksham.language";
const LS_AI_LANG = "saksham.aiReplyLang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // IMPORTANT: do NOT lazy-initialise from localStorage here.
  // The server has no localStorage, so it would render with DEFAULT_LANG,
  // while the client would render with the saved language → hydration mismatch.
  // Instead, initialise with DEFAULT_LANG (matches server), then update from
  // localStorage in a useEffect after mount. This causes a brief 1-frame
  // flash of English before the saved language kicks in, which is acceptable
  // and avoids the hydration error.
  const [lang, setLangState] = useState<LangCode>(DEFAULT_LANG);
  const [aiReplyLang, setAiReplyLangState] = useState<AiLang>("auto");

  // After mount, hydrate from localStorage. This runs only on the client,
  // after React has finished hydration, so it doesn't cause a mismatch.
  // The set-state-in-effect rule is intentionally suppressed here — this is
  // the canonical hydration-safe pattern for client-only state.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_LANG) as LangCode | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && DICTS[saved]) setLangState(saved);
      const aiSaved = localStorage.getItem(LS_AI_LANG) as AiLang | null;
      if (aiSaved) setAiReplyLangState(aiSaved);
    } catch {
      /* localStorage blocked — silently keep defaults */
    }
  }, []);

  // Sync <html lang="..."> so screen readers + browser translate prompts match.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    try {
      localStorage.setItem(LS_LANG, l);
    } catch {
      /* ignore */
    }
  }, []);

  const setAiReplyLang = useCallback((l: AiLang) => {
    setAiReplyLangState(l);
    try {
      localStorage.setItem(LS_AI_LANG, l);
    } catch {
      /* ignore */
    }
  }, []);

  const resolvedAiLang: LangCode = aiReplyLang === "auto" ? lang : aiReplyLang;

  const dict = DICTS[lang] ?? DICTS.en;

  const t = useCallback<TFn>(
    (path, vars) => {
      const template = resolveKey(dict, path);
      return interpolate(template, vars);
    },
    [dict],
  );

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang,
      aiReplyLang,
      setAiReplyLang,
      resolvedAiLang,
      t,
      dict,
    }),
    [lang, setLang, aiReplyLang, setAiReplyLang, resolvedAiLang, t, dict],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LanguageProvider>");
  return ctx;
}

/** Convenience hook — returns just the t() function bound to current language. */
export function useT(): TFn {
  return useLang().t;
}

export { LANGS };
