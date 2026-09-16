/**
 * Inspect the 5 JSON seed databases and print shape summaries.
 * Usage: node scripts/inspect-db.js
 */
const path = require("node:path");
const fs = require("node:fs");

const DB = path.join(__dirname, "..", "src", "database");
const u = JSON.parse(fs.readFileSync(path.join(DB, "users.json"), "utf8"));
const a = JSON.parse(fs.readFileSync(path.join(DB, "assessments.json"), "utf8"));
const c = JSON.parse(fs.readFileSync(path.join(DB, "catalog.json"), "utf8"));
const t = JSON.parse(fs.readFileSync(path.join(DB, "training.json"), "utf8"));

console.log("=== USERS ===");
for (const [email, rec] of Object.entries(u)) {
  console.log(
    JSON.stringify({
      email,
      name: rec.username,
      appRole: rec.appRole,
      role: rec.role,
      dept: rec.department,
      org: rec.organization,
      designation: rec.designation,
      group: rec.group,
      location: rec.location,
      reportsTo: rec.reportsTo,
      years: rec.yearsOfService,
      ncomp: (rec.competencies || []).length,
      nHist: (rec.assessmentHistory || []).length,
      nExam: (rec.examHistory || []).length,
      done: rec.assessmentsDone,
      examsDone: rec.examsDone,
      compNames: (rec.competencies || []).map((x) => x.name),
    })
  );
}

console.log("=== ASSESSMENTS ===");
console.log(JSON.stringify(a.assessments));
console.log("=== EXAMS ===");
console.log(JSON.stringify(a.exams));
console.log("QBANKS:", Object.keys(a.questionBank));
console.log("EXAM BANKS:", Object.keys(a.examQuestionBank));
const firstBankKey = Object.keys(a.questionBank)[0];
console.log("sample q:", JSON.stringify(a.questionBank[firstBankKey][0]));

console.log("=== HISTORY SAMPLE (demo officer) ===");
const demo = u["demo.officer@gov.in"];
console.log(JSON.stringify(demo.assessmentHistory, null, 1).slice(0, 1500));

console.log("=== CATALOG ===");
console.log("departments:", c.departments);
console.log("workforce rows:", c.workforce.length, JSON.stringify(c.workforce[0]));
console.log("competencyCategories:", Object.keys(c.competencyCategories));

console.log("=== TRAINING ===");
console.log(JSON.stringify(t.trainingPrograms, null, 1).slice(0, 800));
