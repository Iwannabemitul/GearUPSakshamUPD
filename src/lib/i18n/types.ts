/**
 * Saksham Skill Intelligence — Internationalisation layer.
 *
 * Supports 10 languages: English plus 9 Indian languages from the 8th Schedule.
 *
 *   en  English
 *   hi  हिन्दी (Hindi)
 *   ta  தமிழ் (Tamil)
 *   te  తెలుగు (Telugu)
 *   bn  বাংলা (Bengali)
 *   mr  मराठी (Marathi)
 *   gu  ગુજરાતી (Gujarati)
 *   kn  ಕನ್ನಡ (Kannada)
 *   ml  മലയാളം (Malayalam)
 *   pa  ਪੰਜਾਬੀ (Punjabi)
 *
 * Strings are grouped into five namespaces matching the original vanilla app:
 *   ui, nav, common, login, pages.
 */

export type LangCode =
  | "en"
  | "hi"
  | "ta"
  | "te"
  | "bn"
  | "mr"
  | "gu"
  | "kn"
  | "ml"
  | "pa";

export const LANGS: { code: LangCode; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "te", label: "Telugu", native: "తెలుగు" },
  { code: "bn", label: "Bengali", native: "বাংলা" },
  { code: "mr", label: "Marathi", native: "मराठी" },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam", native: "മലയാളം" },
  { code: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
];

export const DEFAULT_LANG: LangCode = "en";

export type Dict = {
  ui: Record<string, string>;
  nav: Record<string, string>;
  common: Record<string, string>;
  login: Record<string, string>;
  pages: Record<string, string>;
};

/** Convenience type for the t() function returned by useT(). */
export type TFn = (path: string, vars?: Record<string, string | number>) => string;

/** Resolve a dotted path like "common.startAssessment" against a dictionary. */
export function resolveKey(dict: Dict, path: string): string {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return path;
    }
  }
  return typeof cur === "string" ? cur : path;
}

/** Interpolate {placeholders} in a translated string. */
export function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    k in vars ? String(vars[k]) : `{${k}}`,
  );
}
