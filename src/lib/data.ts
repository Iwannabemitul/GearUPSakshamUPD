/**
 * Saksham Skill Intelligence — in-memory data layer.
 *
 * All five JSON databases from the original prototype are loaded into typed
 * TypeScript constants so the rest of the app can import them as ordinary
 * values without talking to a server. This keeps the migrated Next.js app
 * self-contained (no Express backend required for read operations).
 *
 * Write operations (login sessions, assessment submission) are handled by the
 * socket.io mini-service at /home/z/my-project/mini-services/ai-service.
 */

import usersJson from "@/database/users.json";
import catalogJson from "@/database/catalog.json";
import trainingJson from "@/database/training.json";
import aiJson from "@/database/ai.json";
import assessmentsJson from "@/database/assessments.json";

// Re-export so consumers can `import { aiQa } from "@/lib/data"` without
// having to know about the underlying JSON shape.
export const aiQa = (aiJson as { aiQa: Array<{ q: string; a: string }> }).aiQa;

export type Role = "employee" | "trainer" | "admin";

export type Competency = {
  name: string;
  current: number;
  required: number;
  evidence: string;
  lastAssessed: string;
};

export type AssessmentMeta = {
  id: string;
  title: string;
  competency: string;
  questions: number;
  minutes: number;
  difficulty: string;
};

export type Question = {
  q: string;
  options: string[];
  answer: number;
  explanation: string;
};

export type AssessmentHistoryEntry = {
  assessment: AssessmentMeta;
  score: number;
  correct?: number;
  wrong?: number;
  skipped?: number;
  prevLevel: number;
  newLevel: number;
  aiReport?: string;
  questionReview?: Question[];
};

export type UserRecord = {
  username: string;
  password: string;
  session: string;
  id: number;
  designation: string;
  department: string;
  organization: string;
  group: string;
  location: string;
  yearsOfService: number;
  role: string;
  reportsTo: string;
  appRole: Role;
  competencies: Competency[];
  assessmentsDone: string[];
  assessmentHistory: AssessmentHistoryEntry[];
  examsDone: string[];
  examHistory: AssessmentHistoryEntry[];
};

export type Course = {
  id: string;
  title: string;
  provider: string;
  competency: string;
  duration: string;
  mode: string;
  difficulty: string;
};

export type LearningPhase = {
  phase: number;
  title: string;
  status: "Completed" | "In Progress" | "Recommended" | "Upcoming";
  duration: string;
  difficulty: string;
  source: string;
  expected: string;
};

export type OrgGap = {
  competency: string;
  affected: number;
  avgCurrent: number;
  required: number;
  priority: "Critical" | "High" | "Medium" | "Low";
};

export type WorkforceRow = {
  name: string;
  dept: string;
  role: string;
  SQL: number;
  "Data Quality": number;
  "Survey Design": number;
  "Data Visualization": number;
};

export type TrainingEffectiveness = {
  program: string;
  before: number;
  after: number;
  completion: number;
  participants: number;
};

export type Activity = {
  name: string;
  competencies: string[];
};

type CatalogShape = {
  activities: Activity[];
  competencyCategories: Record<string, string[]>;
  impactText: Record<string, string>;
  courses: Course[];
  learningPathSql: LearningPhase[];
  departments: string[];
  workforce: WorkforceRow[];
  orgGaps: OrgGap[];
  trainingEffectiveness: TrainingEffectiveness[];
  levelNames: string[];
  priorityStyles: Record<
    "Critical" | "High" | "Medium" | "Low",
    { fg: string; bg: string }
  >;
  requiredByRole: Record<string, number>;
};

const catalog = catalogJson as CatalogShape;
const users = usersJson as unknown as Record<string, UserRecord>;
const training = trainingJson as {
  trainingPrograms: Array<{
    id: string;
    title: string;
    competency: string;
    targetRole: string;
    targetLevel: string;
    duration: string;
    mode: string;
    trainer: string;
    participants: number;
    status: "Active" | "Completed" | "Draft";
  }>;
};
const ai = aiJson as {
  aiQa: Array<{ q: string; a: string }>;
};
const assessments = assessmentsJson as {
  assessments: AssessmentMeta[];
  questionBank: Record<string, Question[]>;
  exams: AssessmentMeta[];
  examQuestionBank: Record<string, Question[]>;
};

export const CATALOG = catalog;
export const USERS = users;
export const TRAINING = training;
export const AI = ai;
export const ASSESSMENTS = assessments;

export const LEVEL_NAMES = catalog.levelNames; // ['', 'Beginner','Basic','Intermediate','Advanced','Expert']
export const PRIORITY_STYLES = catalog.priorityStyles;

export function getDemoUser(role: Role): UserRecord {
  if (role === "employee") return users["demo.officer@gov.in"];
  if (role === "admin") return users["admin@test.com"];
  return users["demo.officer@gov.in"]; // trainer falls back to same shape; we synthesise below
}

export function getUserByEmail(email: string): UserRecord | undefined {
  return users[email];
}

export type AppData = {
  employee: {
    name: string;
    id: number;
    designation: string;
    department: string;
    organization: string;
    group: string;
    location: string;
    yearsOfService: number;
    role: string;
    reportsTo: string;
  };
  competencies: Competency[];
  competencyCategories: Record<string, string[]>;
  impactText: Record<string, string>;
  activities: Activity[];
  courses: Course[];
  learningPathSql: LearningPhase[];
  assessments: AssessmentMeta[];
  exams: AssessmentMeta[];
  questionBank: Record<string, Question[]>;
  examQuestionBank: Record<string, Question[]>;
  assessmentsDone: string[];
  assessmentHistory: AssessmentHistoryEntry[];
  examsDone: string[];
  examHistory: AssessmentHistoryEntry[];
  levelNames: string[];
  priorityStyles: typeof catalog.priorityStyles;
  requiredByRole: Record<string, number>;
  trainingPrograms: typeof training.trainingPrograms;
  departments: string[];
  workforce: WorkforceRow[];
  orgGaps: OrgGap[];
  trainingEffectiveness: TrainingEffectiveness[];
};

/**
 * Build the full app-data bundle served to the client after a successful login.
 * In the original vanilla app this came over a WebSocket; in the Next.js port
 * we materialise it directly on the client.
 */
export function buildAppData(role: Role, email?: string): AppData {
  const u =
    (email && users[email]) ||
    (role === "admin"
      ? users["admin@test.com"]
      : users["demo.officer@gov.in"]);

  return {
    employee: {
      name: u.username,
      id: u.id,
      designation: u.designation,
      department: u.department,
      organization: u.organization,
      group: u.group,
      location: u.location,
      yearsOfService: u.yearsOfService,
      role: u.role,
      reportsTo: u.reportsTo,
    },
    competencies: u.competencies,
    competencyCategories: catalog.competencyCategories,
    impactText: catalog.impactText,
    activities: catalog.activities,
    courses: catalog.courses,
    learningPathSql: catalog.learningPathSql,
    assessments: assessments.assessments,
    exams: assessments.exams,
    questionBank: assessments.questionBank,
    examQuestionBank: assessments.examQuestionBank,
    assessmentsDone: u.assessmentsDone,
    assessmentHistory: u.assessmentHistory,
    examsDone: u.examsDone,
    examHistory: u.examHistory,
    levelNames: catalog.levelNames,
    priorityStyles: catalog.priorityStyles,
    requiredByRole: catalog.requiredByRole,
    trainingPrograms: training.trainingPrograms,
    departments: catalog.departments,
    workforce: catalog.workforce,
    orgGaps: catalog.orgGaps,
    trainingEffectiveness: catalog.trainingEffectiveness,
  };
}
