/**
 * Saksham i18n barrel.
 *
 * Exports the LANGS list, the dictionary map, and helpers `tFor(lang, path)`
 * (stateful translation lookup) and `interpolate` (placeholder fill-in).
 */

import { en } from "./en";
import { hi } from "./hi";
import { ta } from "./ta";
import { te } from "./te";
import { bn } from "./bn";
import { mr } from "./mr";
import { gu } from "./gu";
import { kn } from "./kn";
import { ml } from "./ml";
import { pa } from "./pa";

export type { Dict, LangCode, TFn } from "./types";
export { LANGS, DEFAULT_LANG, resolveKey, interpolate } from "./types";
import { resolveKey, interpolate } from "./types";

export const DICTS = { en, hi, ta, te, bn, mr, gu, kn, ml, pa } as const;

import type { Dict, LangCode } from "./types";

/** Translate `path` for `lang`, falling back to English then to the raw key. */
export function tFor(
  lang: LangCode,
  path: string,
  vars?: Record<string, string | number>,
): string {
  const dict: Dict | undefined = DICTS[lang] ?? en;
  const template = resolveKey(dict, path);
  return interpolate(template, vars);
}
