# Native-speaker translation audit — checklist (Workstream C.1)

**Status:** The mechanical half of this workstream is done; the linguistic half
needs native speakers and cannot be responsibly automated.

## What has been done automatically

- `scripts/i18n-audit.js` — compares every language against `en.ts` and
  reports missing keys (rendered via English fallback), orphan keys, and
  duplicate keys. Regenerate any time with `node scripts/i18n-audit.js`;
  the report lands in `docs/i18n-coverage.md`.
- `hi.ts` (Hindi) is **complete**: 0 missing keys — every English string has
  a Hindi translation, including all Workstream A/B/C additions
  (assignments, activity feed, notifications, accessibility toolbar,
  About/Privacy/Terms).
- The other 8 languages (`ta, te, bn, mr, gu, kn, ml, pa`) are missing
  **39 keys each** (see `docs/i18n-coverage.md` for the exact list). These
  render in English today. They are the translation queue.

## Per-language review checklist (for a native speaker)

For each language file `src/lib/i18n/<lang>.ts`:

1. **Translate the 39 missing keys** listed in `docs/i18n-coverage.md`
   (mostly trainer/admin KPI labels: "Total employees", "Average assessment
   score", priority/status words, etc.).
2. **Register check for government-appropriate tone.** Terms with multiple
   valid translations — resolve deliberately, then use consistently:
   - *proctor / proctored* — invigilation vs monitoring register
   - *competency* — skill vs capability vs competency
   - *capacity-building*
   - *evidence* (in the competency-profile sense)
   - *checkpoint* (a short assessment)
   - *assignment* (a trainer task, not homework)
   - *learning path*
3. **Consistency:** the same English term must map to the same word in every
   screen. Search the file for each key term above and confirm one spelling.
4. **Formality:** the UI addresses the user respectfully (the app is used by
   government employees); prefer the respectful pronoun/register.
5. **Placeholders:** strings like `{max}`, `{score}`, `{name}`, `{prev}`,
   `{new}` must survive translation with braces intact.
6. **Length:** translated labels must fit sidebar width (≈180 px) — flag
   anything that wraps awkwardly at 375 px mobile width.
7. **Do not retranslate** keys already correct; deliver corrections as a diff
   against the file.

## Sign-off

A language is "audited" when: (a) 0 missing keys in `docs/i18n-coverage.md`,
(b) the register decisions above are recorded in a table in this file, and
(c) a native speaker has eyeballed the app in that language (switch the
language in the topbar, walk Login → Dashboard → Assessments → Progress).
