/**
 * Shared seed source — normalises the 5 prototype JSON databases into the
 * record shapes used by both Store backends (SQLite via Prisma, MongoDB).
 *
 * Consumed by `prisma/seed.ts` (SQLite) and `scripts/seed-mongo.ts` (Mongo).
 * Both writers are idempotent: re-running never duplicates records.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const DB_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "database");

function loadJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DB_DIR, name), "utf8"));
}

type RawUser = {
  username: string;
  password: string;
  id: number;
  designation: string;
  department: string;
  organization: string;
  group: string;
  location: string;
  yearsOfService: number;
  role: string;
  reportsTo: string;
  appRole: string;
  competencies: Array<{
    name: string;
    current: number;
    required: number;
    evidence: string;
    lastAssessed: string;
  }>;
  assessmentHistory: Array<{
    assessment: { id: string; title: string; competency: string; questions: number; minutes: number; difficulty: string };
    score: number;
    correct?: number;
    wrong?: number;
    skipped?: number;
    prevLevel: number;
    newLevel: number;
  }>;
  examHistory: Array<{
    assessment: { id: string; title: string; competency: string; questions: number; minutes: number; difficulty: string };
    score: number;
    correct?: number;
    wrong?: number;
    skipped?: number;
    prevLevel: number;
    newLevel: number;
  }>;
};

type RawAssessments = {
  assessments: Array<{ id: string; title: string; competency: string; questions: number; minutes: number; difficulty: string }>;
  questionBank: Record<string, Array<{ q: string; options: string[]; answer: number; explanation: string }>>;
  exams: Array<{ id: string; title: string; competency: string; questions: number; minutes: number; difficulty: string }>;
  examQuestionBank: Record<string, Array<{ q: string; options: string[]; answer: number; explanation: string }>>;
};

type RawCatalog = {
  competencyCategories: Record<string, string[]>;
  departments: string[];
};

const rawUsers = loadJson("users.json") as Record<string, RawUser>;
const rawAssessments = loadJson("assessments.json") as RawAssessments;
const rawCatalog = loadJson("catalog.json") as RawCatalog;

function categoryFor(name: string): string | null {
  for (const [category, names] of Object.entries(
    rawCatalog.competencyCategories,
  )) {
    if (names.includes(name)) return category;
  }
  return null;
}

export type SeedUser = {
  email: string;
  passwordHash: string;
  name: string;
  role: "EMPLOYEE" | "TRAINER" | "ADMIN";
  designation: string;
  department: string;
  organization: string;
  location: string;
  yearsOfService: number;
  reportsTo: string;
};

export type SeedCompetency = {
  userEmail: string;
  name: string;
  current: number;
  required: number;
  evidence: string;
  category: string | null;
};

export type SeedAssessment = {
  externalId: string;
  title: string;
  competency: string;
  questions: number;
  minutes: number;
  difficulty: string;
  kind: "CHECKPOINT" | "EXAM";
};

export type SeedQuestion = {
  assessmentExternalId: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  order: number;
};

export type SeedAttempt = {
  userEmail: string;
  assessmentExternalId: string;
  score: number;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  prevLevel: number;
  newLevel: number;
};

/**
 * The prototype had no standalone trainer record — the login page synthesised
 * "Suman Bansal" over the employee record. Workstream A gives the Trainer/ATI
 * role a real account in the same department so trainer scoping has data.
 */
export const TRAINER_ACCOUNT = {
  email: "trainer@test.com",
  password: "trainer123",
  name: "Suman Bansal",
  designation: "Training Coordinator, ATI",
  department: "Department of Statistics",
  organization: "Government of Punjab",
  location: "Chandigarh",
  yearsOfService: 9,
  reportsTo: "Director, ATI",
};

async function hashAll(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const [email, u] of Object.entries(rawUsers)) {
    map.set(email, await bcrypt.hash(u.password, 10));
  }
  map.set(TRAINER_ACCOUNT.email, await bcrypt.hash(TRAINER_ACCOUNT.password, 10));
  return map;
}

export async function buildSeedData(): Promise<{
  users: SeedUser[];
  competencies: SeedCompetency[];
  assessments: SeedAssessment[];
  questions: SeedQuestion[];
  attempts: SeedAttempt[];
}> {
  const hashes = await hashAll();

  const users: SeedUser[] = Object.entries(rawUsers).map(([email, u]) => ({
    email,
    passwordHash: hashes.get(email) as string,
    name: u.username,
    role: u.appRole === "admin" ? "ADMIN" : "EMPLOYEE",
    designation: u.designation,
    department: u.department,
    organization: u.organization,
    location: u.location,
    yearsOfService: u.yearsOfService,
    reportsTo: u.reportsTo,
  }));

  users.push({
    email: TRAINER_ACCOUNT.email,
    passwordHash: hashes.get(TRAINER_ACCOUNT.email) as string,
    name: TRAINER_ACCOUNT.name,
    role: "TRAINER",
    designation: TRAINER_ACCOUNT.designation,
    department: TRAINER_ACCOUNT.department,
    organization: TRAINER_ACCOUNT.organization,
    location: TRAINER_ACCOUNT.location,
    yearsOfService: TRAINER_ACCOUNT.yearsOfService,
    reportsTo: TRAINER_ACCOUNT.reportsTo,
  });

  const competencies: SeedCompetency[] = [];
  for (const [email, u] of Object.entries(rawUsers)) {
    for (const c of u.competencies) {
      competencies.push({
        userEmail: email,
        name: c.name,
        current: c.current,
        required: c.required,
        evidence: c.evidence,
        category: categoryFor(c.name),
      });
    }
  }

  const assessments: SeedAssessment[] = [
    ...rawAssessments.assessments.map((a) => ({
      externalId: a.id,
      title: a.title,
      competency: a.competency,
      questions: a.questions,
      minutes: a.minutes,
      difficulty: a.difficulty,
      kind: "CHECKPOINT" as const,
    })),
    ...rawAssessments.exams.map((a) => ({
      externalId: a.id,
      title: a.title,
      competency: a.competency,
      questions: a.questions,
      minutes: a.minutes,
      difficulty: a.difficulty,
      kind: "EXAM" as const,
    })),
  ];

  const questions: SeedQuestion[] = [];
  for (const [externalId, bank] of Object.entries(rawAssessments.questionBank)) {
    bank.forEach((q, i) =>
      questions.push({
        assessmentExternalId: externalId,
        text: q.q,
        options: q.options,
        correctIndex: q.answer,
        explanation: q.explanation,
        order: i,
      }),
    );
  }
  for (const [externalId, bank] of Object.entries(rawAssessments.examQuestionBank)) {
    bank.forEach((q, i) =>
      questions.push({
        assessmentExternalId: externalId,
        text: q.q,
        options: q.options,
        correctIndex: q.answer,
        explanation: q.explanation,
        order: i,
      }),
    );
  }

  const attempts: SeedAttempt[] = [];
  for (const [email, u] of Object.entries(rawUsers)) {
    const histories = [
      ...(u.assessmentHistory ?? []),
      ...(u.examHistory ?? []),
    ];
    for (const h of histories) {
      attempts.push({
        userEmail: email,
        assessmentExternalId: h.assessment.id,
        score: h.score,
        correct: h.correct ?? null,
        wrong: h.wrong ?? null,
        skipped: h.skipped ?? null,
        prevLevel: h.prevLevel,
        newLevel: h.newLevel,
      });
    }
  }

  return { users, competencies, assessments, questions, attempts };
}

export function seedDepartments(): string[] {
  return rawCatalog.departments;
}
