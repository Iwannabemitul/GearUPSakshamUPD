/**
 * Fix pre-existing i18n duplicate-key TS errors: in each language dictionary,
 * `proctorChecking` and `proctorWarnings` appear twice inside the `ui`
 * namespace. The LAST occurrence wins at runtime, so this script removes the
 * earlier duplicates (no behavior change).
 *
 * Run: node scripts/fix-i18n-duplicates.js
 */

const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "..", "src", "lib", "i18n");
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".ts") && f !== "types.ts" && f !== "index.ts");

const DUP_KEYS = ["proctorChecking", "proctorWarnings"];

for (const file of files) {
  const full = path.join(dir, file);
  const lines = fs.readFileSync(full, "utf8").split("\n");
  const toRemove = new Set();

  for (const key of DUP_KEYS) {
    const matches = [];
    lines.forEach((l, i) => {
      if (new RegExp(`^\\s{4}${key}:`).test(l)) matches.push(i);
    });
    // keep the last occurrence, drop the earlier ones
    for (let i = 0; i < matches.length - 1; i++) toRemove.add(matches[i]);
  }

  if (toRemove.size === 0) continue;
  const kept = lines.filter((_, i) => !toRemove.has(i));
  fs.writeFileSync(full, kept.join("\n"));
  console.log(`${file}: removed ${toRemove.size} duplicate line(s)`);
}
console.log("done");
