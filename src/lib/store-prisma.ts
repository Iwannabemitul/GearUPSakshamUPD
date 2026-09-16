/**
 * PrismaStore — SQLite implementation of the Store interface (default backend).
 */

import { PrismaClient, Prisma } from "@prisma/client";
import type {
  NewAttemptAnswers,
  NewAssignment,
  Store,
  StoreAiProfileSummary,
  StoreAssignment,
  StoreAssignmentStatus,
  StoreAssignmentType,
  StoreAssessmentMeta,
  StoreAttempt,
  StoreAttemptWithMeta,
  StoreCompetency,
  StoreFeedAttempt,
  StoreQuestion,
  StoreRole,
  StoreUser,
} from "@/lib/store";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

function parseJsonArray<T>(raw: string | null | undefined): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toRole(v: string): StoreRole {
  return v === "TRAINER" || v === "ADMIN" ? v : "EMPLOYEE";
}

function toKind(v: string): "CHECKPOINT" | "EXAM" {
  return v === "EXAM" ? "EXAM" : "CHECKPOINT";
}

export class PrismaStore implements Store {
  private db = client();

  // --- users ---

  async getUserByEmail(email: string): Promise<StoreUser | null> {
    const u = await this.db.user.findUnique({ where: { email } });
    return u ? { ...u, role: toRole(u.role) } : null;
  }

  async getUserById(id: string): Promise<StoreUser | null> {
    const u = await this.db.user.findUnique({ where: { id } });
    return u ? { ...u, role: toRole(u.role) } : null;
  }

  async listUsers(): Promise<Omit<StoreUser, "passwordHash">[]> {
    const users = await this.db.user.findMany({ orderBy: { name: "asc" } });
    return users.map(({ passwordHash: _ph, ...u }) => ({
      ...u,
      role: toRole(u.role),
    }));
  }

  async listUsersByDepartment(
    department: string,
  ): Promise<Omit<StoreUser, "passwordHash">[]> {
    const users = await this.db.user.findMany({
      where: { department, role: { not: "ADMIN" } },
      orderBy: { name: "asc" },
    });
    return users.map(({ passwordHash: _ph, ...u }) => ({
      ...u,
      role: toRole(u.role),
    }));
  }

  // --- competencies ---

  async getCompetencies(userId: string): Promise<StoreCompetency[]> {
    return this.db.competency.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
  }

  async updateCompetencyLevel(
    userId: string,
    name: string,
    current: number,
  ): Promise<void> {
    await this.db.competency.updateMany({
      where: { userId, name },
      data: { current, lastAssessed: new Date() },
    });
  }

  // --- assessments ---

  private metaFrom(row: {
    id: string;
    externalId: string;
    title: string;
    competency: string;
    questions: number;
    minutes: number;
    difficulty: string;
    kind: string;
    isPublished: boolean;
    authorId: string | null;
  }): StoreAssessmentMeta {
    return { ...row, kind: toKind(row.kind) };
  }

  async getAssessmentMetaByExternalId(
    externalId: string,
  ): Promise<StoreAssessmentMeta | null> {
    const row = await this.db.assessmentMeta.findUnique({ where: { externalId } });
    return row ? this.metaFrom(row) : null;
  }

  async getAssessmentMetaById(id: string): Promise<StoreAssessmentMeta | null> {
    const row = await this.db.assessmentMeta.findUnique({ where: { id } });
    return row ? this.metaFrom(row) : null;
  }

  async listAssessmentMetas(): Promise<StoreAssessmentMeta[]> {
    const rows = await this.db.assessmentMeta.findMany({
      orderBy: { externalId: "asc" },
    });
    return rows.map((r) => this.metaFrom(r));
  }

  async getQuestions(assessmentMetaId: string): Promise<StoreQuestion[]> {
    const rows = await this.db.question.findMany({
      where: { assessmentId: assessmentMetaId },
      orderBy: { order: "asc" },
    });
    return rows.map((q) => ({
      id: q.id,
      assessmentId: q.assessmentId,
      text: q.text,
      options: parseJsonArray<string>(q.options) ?? [],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      order: q.order,
    }));
  }

  async createGeneratedAssessment(
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
  ): Promise<StoreAssessmentMeta> {
    const row = await this.db.assessmentMeta.create({
      data: {
        externalId: meta.externalId,
        title: meta.title,
        competency: meta.competency,
        questions: meta.questions,
        minutes: meta.minutes,
        difficulty: meta.difficulty,
        kind: meta.kind,
        isPublished: true,
        authorId,
        items: {
          create: questions.map((q, i) => ({
            text: q.text,
            options: JSON.stringify(q.options),
            correctIndex: q.correctIndex,
            explanation: q.explanation ?? null,
            order: i,
          })),
        },
      },
    });
    return this.metaFrom(row);
  }

  // --- attempts ---

  private attemptFrom(row: Prisma.AssessmentAttemptGetPayload<null>): StoreAttempt {
    return {
      id: row.id,
      userId: row.userId,
      assessmentId: row.assessmentId,
      startedAt: row.startedAt,
      submittedAt: row.submittedAt,
      score: row.score,
      correct: row.correct,
      wrong: row.wrong,
      skipped: row.skipped,
      prevLevel: row.prevLevel,
      newLevel: row.newLevel,
      terminatedReason: row.terminatedReason,
      violations: parseJsonArray<{ reason: string; at: string }>(row.violations),
      answers: parseJsonArray<{ questionId: string; userIndex: number }>(
        row.answers,
      ),
    };
  }

  async createAttempt(
    userId: string,
    assessmentMetaId: string,
  ): Promise<StoreAttempt> {
    const row = await this.db.assessmentAttempt.create({
      data: { userId, assessmentId: assessmentMetaId },
    });
    return this.attemptFrom(row);
  }

  async getAttempt(id: string): Promise<StoreAttempt | null> {
    const row = await this.db.assessmentAttempt.findUnique({ where: { id } });
    return row ? this.attemptFrom(row) : null;
  }

  async submitAttempt(
    id: string,
    payload: NewAttemptAnswers,
  ): Promise<StoreAttempt> {
    const row = await this.db.assessmentAttempt.update({
      where: { id },
      data: {
        submittedAt: new Date(),
        score: payload.score,
        correct: payload.correct,
        wrong: payload.wrong,
        skipped: payload.skipped,
        prevLevel: payload.prevLevel,
        newLevel: payload.newLevel,
        terminatedReason: payload.terminatedReason,
        violations: payload.violations ? JSON.stringify(payload.violations) : null,
        answers: payload.answers ? JSON.stringify(payload.answers) : null,
      },
    });
    return this.attemptFrom(row);
  }

  async listAttemptsByUser(
    userId: string,
    since?: Date,
  ): Promise<StoreAttemptWithMeta[]> {
    const rows = await this.db.assessmentAttempt.findMany({
      where: {
        userId,
        submittedAt: { not: null, ...(since ? { gt: since } : {}) },
      },
      include: { assessment: true },
      orderBy: { submittedAt: "desc" },
      take: 200,
    });
    return rows.map((r) => ({
      ...this.attemptFrom(r),
      assessmentExternalId: r.assessment.externalId,
      assessmentTitle: r.assessment.title,
      assessmentCompetency: r.assessment.competency,
      assessmentKind: toKind(r.assessment.kind),
    }));
  }

  async listSubmittedAttempts(opts: {
    since?: Date;
    department?: string | null;
    limit?: number;
  }): Promise<StoreFeedAttempt[]> {
    const rows = await this.db.assessmentAttempt.findMany({
      where: {
        submittedAt: { not: null, ...(opts.since ? { gt: opts.since } : {}) },
        ...(opts.department ? { user: { department: opts.department } } : {}),
      },
      include: { assessment: true, user: true },
      orderBy: { submittedAt: "desc" },
      take: opts.limit ?? 50,
    });
    return rows.map((r) => ({
      ...this.attemptFrom(r),
      assessmentExternalId: r.assessment.externalId,
      assessmentTitle: r.assessment.title,
      assessmentCompetency: r.assessment.competency,
      assessmentKind: toKind(r.assessment.kind),
      userName: r.user.name,
      userEmail: r.user.email,
      userDepartment: r.user.department,
    }));
  }

  // --- assignments ---

  private assignmentFrom(
    row: Prisma.AssignmentGetPayload<{ include: { author: true; assignee: true } }>,
  ): StoreAssignment {
    return {
      id: row.id,
      authorId: row.authorId,
      authorName: row.author.name,
      assigneeId: row.assigneeId,
      assigneeName: row.assignee.name,
      type: row.type as StoreAssignmentType,
      assessmentId: row.assessmentId,
      courseId: row.courseId,
      note: row.note,
      dueAt: row.dueAt,
      status: row.status as StoreAssignmentStatus,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  async createAssignment(data: NewAssignment): Promise<StoreAssignment> {
    const row = await this.db.assignment.create({
      data: {
        authorId: data.authorId,
        assigneeId: data.assigneeId,
        type: data.type,
        assessmentId: data.assessmentId ?? null,
        courseId: data.courseId ?? null,
        note: data.note ?? null,
        dueAt: data.dueAt ?? null,
      },
      include: { author: true, assignee: true },
    });
    return this.assignmentFrom(row);
  }

  async getAssignment(id: string): Promise<StoreAssignment | null> {
    const row = await this.db.assignment.findUnique({
      where: { id },
      include: { author: true, assignee: true },
    });
    return row ? this.assignmentFrom(row) : null;
  }

  async updateAssignment(
    id: string,
    patch: { status?: StoreAssignmentStatus; completedAt?: Date | null },
  ): Promise<StoreAssignment> {
    const row = await this.db.assignment.update({
      where: { id },
      data: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.completedAt !== undefined
          ? { completedAt: patch.completedAt }
          : {}),
      },
      include: { author: true, assignee: true },
    });
    return this.assignmentFrom(row);
  }

  async listAssignmentsForAssignee(
    assigneeId: string,
    since?: Date,
  ): Promise<StoreAssignment[]> {
    const rows = await this.db.assignment.findMany({
      where: {
        assigneeId,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      include: { author: true, assignee: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.assignmentFrom(r));
  }

  async listAssignmentsForAuthor(
    authorId: string,
    since?: Date,
  ): Promise<StoreAssignment[]> {
    const rows = await this.db.assignment.findMany({
      where: {
        authorId,
        ...(since ? { createdAt: { gt: since } } : {}),
      },
      include: { author: true, assignee: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.assignmentFrom(r));
  }

  async listAllAssignments(since?: Date): Promise<StoreAssignment[]> {
    const rows = await this.db.assignment.findMany({
      where: since ? { createdAt: { gt: since } } : {},
      include: { author: true, assignee: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((r) => this.assignmentFrom(r));
  }

  async completeAssignmentsForAssessment(
    assigneeId: string,
    assessmentExternalId: string,
  ): Promise<StoreAssignment[]> {
    const rows = await this.db.assignment.findMany({
      where: {
        assigneeId,
        assessmentId: assessmentExternalId,
        status: { in: ["PENDING", "STARTED"] },
      },
      include: { author: true, assignee: true },
    });
    const updated: StoreAssignment[] = [];
    for (const row of rows) {
      const r = await this.db.assignment.update({
        where: { id: row.id },
        data: { status: "COMPLETED", completedAt: new Date() },
        include: { author: true, assignee: true },
      });
      updated.push(this.assignmentFrom(r));
    }
    return updated;
  }

  // --- AI profile summary ---

  async saveAiProfileSummary(
    summary: Omit<StoreAiProfileSummary, "generatedAt">,
  ): Promise<StoreAiProfileSummary> {
    const row = await this.db.aiProfileSummary.upsert({
      where: { userId: summary.userId },
      create: { ...summary },
      update: { ...summary },
    });
    return row;
  }

  async getAiProfileSummary(
    userId: string,
  ): Promise<StoreAiProfileSummary | null> {
    const row = await this.db.aiProfileSummary.findUnique({
      where: { userId },
    });
    return row ?? null;
  }
}
