/**
 * Saksham storage abstraction (server-side only).
 *
 * Workstream A persists all shared state (users, competencies, assessments,
 * attempts, assignments) behind a single `Store` interface with two adapters:
 *
 *   - PrismaStore  — SQLite via Prisma (`DATA_BACKEND=sqlite`, the default)
 *   - MongoStore   — MongoDB Atlas / local Mongo (`DATA_BACKEND=mongo`)
 *
 * API routes only ever talk to `getStore()`, so switching backends is a
 * one-line .env change plus a seed run. This module must never be imported
 * from client components.
 */

export type StoreRole = "EMPLOYEE" | "TRAINER" | "ADMIN";

export type StoreUser = {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: StoreRole;
  designation: string | null;
  department: string | null;
  organization: string | null;
  location: string | null;
  yearsOfService: number | null;
  reportsTo: string | null;
};

export type StoreCompetency = {
  id: string;
  userId: string;
  name: string;
  current: number;
  required: number;
  evidence: string | null;
  lastAssessed: Date | null;
  category: string | null;
};

export type StoreAssessmentMeta = {
  id: string;
  externalId: string; // "a-sql", "e-sql", ...
  title: string;
  competency: string;
  questions: number;
  minutes: number;
  difficulty: string;
  kind: "CHECKPOINT" | "EXAM";
  isPublished: boolean;
  authorId: string | null;
};

export type StoreQuestion = {
  id: string;
  assessmentId: string;
  text: string;
  options: string[]; // parsed from the JSON column
  correctIndex: number;
  explanation: string | null;
  order: number;
};

export type StoreAttempt = {
  id: string;
  userId: string;
  assessmentId: string; // AssessmentMeta.id (internal)
  startedAt: Date;
  submittedAt: Date | null;
  score: number | null;
  correct: number | null;
  wrong: number | null;
  skipped: number | null;
  prevLevel: number | null;
  newLevel: number | null;
  terminatedReason: string | null;
  violations: Array<{ reason: string; at: string }> | null;
  answers: Array<{ questionId: string; userIndex: number }> | null;
};

export type StoreAttemptWithMeta = StoreAttempt & {
  assessmentExternalId: string;
  assessmentTitle: string;
  assessmentCompetency: string;
  assessmentKind: "CHECKPOINT" | "EXAM";
};

export type StoreFeedAttempt = StoreAttemptWithMeta & {
  userName: string;
  userEmail: string;
  userDepartment: string | null;
};

export type StoreAssignmentType =
  | "ASSESSMENT"
  | "EXAM"
  | "COURSE"
  | "LEARNING_PATH";

export type StoreAssignmentStatus =
  | "PENDING"
  | "STARTED"
  | "COMPLETED"
  | "EXPIRED";

export type StoreAssignment = {
  id: string;
  authorId: string;
  authorName: string | null;
  assigneeId: string;
  assigneeName: string | null;
  type: StoreAssignmentType;
  assessmentId: string | null; // external assessment id
  courseId: string | null;
  note: string | null;
  dueAt: Date | null;
  status: StoreAssignmentStatus;
  createdAt: Date;
  completedAt: Date | null;
};

export type NewAssignment = {
  authorId: string;
  assigneeId: string;
  type: StoreAssignmentType;
  assessmentId?: string | null;
  courseId?: string | null;
  note?: string | null;
  dueAt?: Date | null;
};

export type NewAttemptAnswers = {
  answers: Array<{ questionId: string; userIndex: number }> | null;
  violations: Array<{ reason: string; at: string }> | null;
  terminatedReason: string | null;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  prevLevel: number;
  newLevel: number;
};

export interface Store {
  // --- users ---
  getUserByEmail(email: string): Promise<StoreUser | null>;
  getUserById(id: string): Promise<StoreUser | null>;
  listUsers(): Promise<Omit<StoreUser, "passwordHash">[]>;
  listUsersByDepartment(department: string): Promise<
    Omit<StoreUser, "passwordHash">[]
  >;

  // --- competencies ---
  getCompetencies(userId: string): Promise<StoreCompetency[]>;
  updateCompetencyLevel(
    userId: string,
    name: string,
    current: number,
  ): Promise<void>;

  // --- assessments ---
  getAssessmentMetaByExternalId(
    externalId: string,
  ): Promise<StoreAssessmentMeta | null>;
  getAssessmentMetaById(id: string): Promise<StoreAssessmentMeta | null>;
  listAssessmentMetas(): Promise<StoreAssessmentMeta[]>;
  getQuestions(assessmentMetaId: string): Promise<StoreQuestion[]>;
  createGeneratedAssessment(
    meta: {
      externalId: string;
      title: string;
      competency: string;
      questions: number;
      minutes: number;
      difficulty: string;
      kind: "CHECKPOINT" | "EXAM";
    },
    questions: Array<{
      text: string;
      options: string[];
      correctIndex: number;
      explanation?: string | null;
    }>,
    authorId: string,
  ): Promise<StoreAssessmentMeta>;

  // --- attempts ---
  createAttempt(userId: string, assessmentMetaId: string): Promise<StoreAttempt>;
  getAttempt(id: string): Promise<StoreAttempt | null>;
  submitAttempt(id: string, payload: NewAttemptAnswers): Promise<StoreAttempt>;
  listAttemptsByUser(userId: string, since?: Date): Promise<
    StoreAttemptWithMeta[]
  >;
  listSubmittedAttempts(opts: {
    since?: Date;
    department?: string | null; // null = all departments (admin)
    limit?: number;
  }): Promise<StoreFeedAttempt[]>;

  // --- assignments ---
  createAssignment(data: NewAssignment): Promise<StoreAssignment>;
  getAssignment(id: string): Promise<StoreAssignment | null>;
  updateAssignment(
    id: string,
    patch: {
      status?: StoreAssignmentStatus;
      completedAt?: Date | null;
    },
  ): Promise<StoreAssignment>;
  listAssignmentsForAssignee(
    assigneeId: string,
    since?: Date,
  ): Promise<StoreAssignment[]>;
  listAssignmentsForAuthor(
    authorId: string,
    since?: Date,
  ): Promise<StoreAssignment[]>;
  listAllAssignments(since?: Date): Promise<StoreAssignment[]>;
  /** Mark all PENDING/STARTED assignments of this user for this assessment
   *  as COMPLETED (called after a successful submission). Returns updated. */
  completeAssignmentsForAssessment(
    assigneeId: string,
    assessmentExternalId: string,
  ): Promise<StoreAssignment[]>;
}

import { PrismaStore } from "@/lib/store-prisma";
import { MongoStore } from "@/lib/store-mongo";

export type DataBackend = "sqlite" | "mongo";

export function getDataBackend(): DataBackend {
  return process.env.DATA_BACKEND === "mongo" ? "mongo" : "sqlite";
}

let prismaSingleton: PrismaStore | null = null;
let mongoSingleton: MongoStore | null = null;

/** Process-wide store selected by DATA_BACKEND (default: sqlite). */
export function getStore(): Store {
  if (getDataBackend() === "mongo") {
    if (!mongoSingleton) mongoSingleton = new MongoStore();
    return mongoSingleton;
  }
  if (!prismaSingleton) prismaSingleton = new PrismaStore();
  return prismaSingleton;
}
