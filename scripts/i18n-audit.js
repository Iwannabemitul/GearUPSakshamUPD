/**
 * i18n audit (Workstream C.1) — mechanical consistency report.
 *
 * Compares every language dictionary against the English base and reports:
 *   - keys present in `en` but MISSING from the language file (visible only
 *     via fallback — usually fine, but listed for reviewers)
 *   - keys the language file has that `en` does not (stale orphans)
 *   - duplicate keys within a namespace (TS errors, runtime last-wins)
 *
 * Output: docs/i18n-coverage.md + console summary.
 * Run: node scripts/i18n-audit.js
 */

const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "src", "lib", "i18n");
const docsDir = path.join(__dirname, "..", "docs");
const LANGS = ["hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"];

function parseKeys(file) {
  // Naive line-based key extraction: "    key: \"...\"," — grouped by the
  // most recent namespace line ("  ui: {", etc.). Good enough for coverage.
  const content = fs.readFileSync(path.join(dir, file), "utf8");
  const lines = content.split("\n");
  const seen = new Map(); // ns -> Map(key -> count)
  let ns = null;
  for (const line of lines) {
    const nsMatch = line.match(/^ {2}(\w+): \{/);
    if (nsMatch) {
      ns = nsMatch[1];
      continue;
    }
    if (/^  {2}\},/.test(line) || /^  {2}\};/.test(line)) {
      ns = null;
      continue;
    }
    const keyMatch = line.match(/^ {4}([A-Za-z0-9_]+):/);
    if (ns && keyMatch) {
      const key = keyMatch[1];
      if (!seen.has(ns)) seen.set(ns, new Map());
      const m = seen.get(ns);
      m.set(key, (m.get(key) ?? 0) + 1);
    }
  }
  return seen;
}

const en = parseKeys("en.ts");
const report = [];
let totalMissing = 0;

for (const lang of LANGS) {
  const dict = parseKeys(`${lang}.ts`);
  const missing = [];
  const orphans = [];
  const dupes = [];

  for (const [ns, keys] of en) {
    const target = dict.get(ns) ?? new Map();
    for (const [key] of keys) {
      if (!target.has(key)) missing.push(`${ns}.${key}`);
    }
  }
  for (const [ns, keys] of dict) {
    const base = en.get(ns) ?? new Map();
    for (const [key, count] of keys) {
      if (!base.has(key)) orphans.push(`${ns}.${key}`);
      if (count > 1) dupes.push(`${ns}.${key} x${count}`);
    }
  }

  totalMissing += missing.length;
  report.push({
    lang,
    missingCount: missing.length,
    orphanCount: orphans.length,
    dupeCount: dupes.length,
    missingSample: missing.slice(0, 12),
    orphanSample: orphans.slice(0, 6),
    dupes: dupes.slice(0, 6),
  });
}

fs.mkdirSync(docsDir, { recursive: true });
const md = [
  "# i18n key coverage (mechanical audit, Workstream C.1)",
  "",
  `Generated: ${new Date().toISOString()} — base: en.ts (~${[...en].reduce((s, [, m]) => s + m.size, 0)} keys).`,
  "Missing keys still WORK (they fall back to English via `...en` spreads) —",
  "this list is the queue for native-speaker translation review.",
  "",
  "| Language | Missing (falls back to en) | Orphans | Duplicates |",
  "|---|---|---|---|",
  ...report.map(
    (r) => `| ${r.lang} | ${r.missingCount} | ${r.orphanCount} | ${r.dupeCount} |`,
  ),
  "",
  ...report.map(
    (r) =>
      `## ${r.lang}\n\n` +
      (r.missingCount > 0
        ? `Missing sample: ${r.missingSample.map((k) => `\`${k}\``).join(", ")}\n`
        : "") +
      (r.orphanCount > 0
        ? `\nOrphans (should be removed or re-added to en): ${r.orphanSample.map((k) => `\`${k}\``).join(", ")}\n`
        : "") +
      (r.dupeCount > 0 ? `\nDuplicates: ${r.dupes.join(", ")}\n` : ""),
  ),
].join("\n");
fs.writeFileSync(path.join(docsDir, "i18n-coverage.md"), md);

console.log(`Total missing keys across languages: ${totalMissing}`);
console.log("Report: docs/i18n-coverage.md");
