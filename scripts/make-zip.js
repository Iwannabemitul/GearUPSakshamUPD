/**
 * Package the project into a clean deliverable ZIP (Windows-safe).
 *
 * Uses a staging copy (robocopy, excluding secrets/build artifacts) and
 * PowerShell Compress-Archive. robocopy exit codes 0-7 are all success.
 *
 * Run: node scripts/make-zip.js [output-name]
 * Default output: download/saksham-multilingual.zip
 */

const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const outDir = path.join(root, "download");
const name = process.argv[2] ?? "saksham-multilingual.zip";
const outPath = path.join(outDir, name);
const staging = path.join(root, ".zip-staging");

fs.mkdirSync(outDir, { recursive: true });
if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging, { recursive: true });

const robocopy = `robocopy "${root}" "${staging}" /E ` +
  `/XD node_modules .next download .zip-staging .git ` +
  `/XF .env "*.db" dev.db-journal "*.log" /NFL /NDL /NJH /NJS /NP`;
try {
  execSync(robocopy, { shell: true, stdio: "ignore" });
} catch (e) {
  // robocopy exit codes: 0-7 = success, >=8 = failure
  const code = e.status ?? 8;
  if (code >= 8) throw e;
}
if (!fs.existsSync(path.join(staging, "package.json"))) {
  throw new Error("robocopy staging failed — package.json missing");
}
execSync(
  `powershell -NoProfile -Command "Compress-Archive -Path '${staging}\\*' -DestinationPath '${outPath}' -Force"`,
  { shell: true, stdio: "inherit" },
);
fs.rmSync(staging, { recursive: true, force: true });

const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
console.log(`Created ${outPath} (${size} MB)`);
