/**
 * MongoStore — MongoDB implementation of the Store interface.
 *
 * Selected with DATA_BACKEND=mongo. Collections mirror the SQLite tables so
 * the same seed data can be loaded into either backend:
 *   users, competencies, assessmentMeta, questions, attempts, assignments
 *
 * ObjectId values are mapped to plain string ids at the adapter boundary.
 */

import { MongoClient, ObjectId, type Collection } from "mongodb";
import type {
  NewAttemptAnswers,
  NewAssignment,
  Store,
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

type UserDoc = Omit<StoreUser, "id"> & { _id: ObjectId };
type CompetencyDoc = Omit<StoreCompetency, "id"> & { _id: ObjectId };
type AssessmentDoc = Omit<StoreAssessmentMeta, "id"> & { _id: ObjectId };
type QuestionDoc = Omit<StoreQuestion, "id" | "options"> & {
  _id: ObjectId;
  options: string; // JSON array string, same as SQLite column
};
type AttemptDoc = Omit<StoreAttempt, "id" | "violations" | "answers"> & {
  _id: ObjectId;
  violations: string | null;
  answers: string | null;
};
type AssignmentDoc = Omit<StoreAssignment, "id"> & { _id: ObjectId };

const globalForMongo = globalThis as unknown as {
  mongoClient: MongoClient | undefined;
  mongoDbPromise: Promise<ReturnType<MongoClient["db"]>> | undefined;
};

function dbName(): string {
  return process.env.MONGODB_DB ?? "saksham";
}

async function db() {
  if (!globalForMongo.mongoClient) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error(
        "DATA_BACKEND=mongo requires MONGODB_URI in the environment (.env).",
      );
    }
    const c = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    globalForMongo.mongoClient = c;
  }
  if (!globalForMongo.mongoDbPromise) {
    globalForMongo.mongoDbPromise = (async () => {
      const client = globalForMongo.mongoClient as MongoClient;
      await client.connect();
      return client.db(dbName());
    })();
  }
  return globalForMongo.mongoDbPromise;
}

function parseJsonArray<T>(raw: string | null): T[] | null {
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

export class MongoStore implements Store {
  private async col<K extends "users" | "competencies" | "assessmentMeta" | "questions" | "attempts" | "assignments">(
    name: K,
  ): Promise<Collection> {
    const d = await db();
    return d.collection(name);
  }

  // --- users ---

  private toUser(doc: UserDoc | null): StoreUser | null {
    if (!doc) return null;
    const { _id, passwordHash, ...rest } = doc;
    return { id: _id.toString(), passwordHash, ...rest, role: toRole(rest.role) };
  }

  async getUserByEmail(email: string): Promise<StoreUser | null> {
    const c = (await this.col("users")) as unknown as Collection<UserDoc>;
    return this.toUser(await c.findOne({ email }));
  }

  async getUserById(id: string): Promise<StoreUser | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = (await this.col("users")) as unknown as Collection<UserDoc>;
    return this.toUser(await c.findOne({ _id: new ObjectId(id) }));
  }

  private stripUser(doc: UserDoc): Omit<StoreUser, "passwordHash"> {
    const { _id, passwordHash: _ph, ...rest } = doc;
    return { id: _id.toString(), ...rest, role: toRole(rest.role) };
  }

  async listUsers(): Promise<Omit<StoreUser, "passwordHash">[]> {
    const c = (await this.col("users")) as unknown as Collection<UserDoc>;
    const docs = await c.find().sort({ name: 1 }).toArray();
    return docs.map((d) => this.stripUser(d));
  }

  async listUsersByDepartment(
    department: string,
  ): Promise<Omit<StoreUser, "passwordHash">[]> {
    const c = (await this.col("users")) as unknown as Collection<UserDoc>;
    const docs = await c
      .find({ department, role: { $ne: "ADMIN" } })
      .sort({ name: 1 })
      .toArray();
    return docs.map((d) => this.stripUser(d));
  }

  // --- competencies ---

  async getCompetencies(userId: string): Promise<StoreCompetency[]> {
    const c = (await this.col("competencies")) as unknown as Collection<CompetencyDoc>;
    const docs = await c.find({ userId }).sort({ name: 1 }).toArray();
    return docs.map(({ _id, ...rest }) => ({ id: _id.toString(), ...rest }));
  }

  async updateCompetencyLevel(
    userId: string,
    name: string,
    current: number,
  ): Promise<void> {
    const c = (await this.col("competencies")) as unknown as Collection<CompetencyDoc>;
    await c.updateOne(
      { userId, name },
      { $set: { current, lastAssessed: new Date() } },
    );
  }

  // --- assessments ---

  private toMeta(doc: AssessmentDoc | null): StoreAssessmentMeta | null {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest, kind: toKind(rest.kind) };
  }

  async getAssessmentMetaByExternalId(
    externalId: string,
  ): Promise<StoreAssessmentMeta | null> {
    const c = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    return this.toMeta(await c.findOne({ externalId }));
  }

  async getAssessmentMetaById(id: string): Promise<StoreAssessmentMeta | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    return this.toMeta(await c.findOne({ _id: new ObjectId(id) }));
  }

  async listAssessmentMetas(): Promise<StoreAssessmentMeta[]> {
    const c = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    const docs = await c.find().sort({ externalId: 1 }).toArray();
    return docs.map((d) => this.toMeta(d) as StoreAssessmentMeta);
  }

  async getQuestions(assessmentMetaId: string): Promise<StoreQuestion[]> {
    const c = (await this.col("questions")) as unknown as Collection<QuestionDoc>;
    const docs = await c
      .find({ assessmentId: assessmentMetaId })
      .sort({ order: 1 })
      .toArray();
    return docs.map(({ _id, ...q }) => ({
      id: _id.toString(),
      ...q,
      options: parseJsonArray<string>(q.options) ?? [],
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
    const mc = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    const qc = (await this.col("questions")) as unknown as Collection<QuestionDoc>;
    const doc: Omit<AssessmentDoc, "_id"> = {
      ...meta,
      isPublished: true,
      authorId,
    };
    const inserted = await mc.insertOne(doc as AssessmentDoc);
    await qc.insertMany(
      questions.map((q, i) => ({
        assessmentId: inserted.insertedId.toString(),
        text: q.text,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation ?? null,
        order: i,
      })) as unknown as QuestionDoc[],
    );
    return { id: inserted.insertedId.toString(), ...doc, kind: toKind(doc.kind) };
  }

  // --- attempts ---

  private toAttempt(doc: AttemptDoc | null): StoreAttempt | null {
    if (!doc) return null;
    const { _id, violations, answers, ...rest } = doc;
    return {
      id: _id.toString(),
      ...rest,
      violations: parseJsonArray<{ reason: string; at: string }>(violations),
      answers: parseJsonArray<{ questionId: string; userIndex: number }>(answers),
    };
  }

  async createAttempt(
    userId: string,
    assessmentMetaId: string,
  ): Promise<StoreAttempt> {
    const c = (await this.col("attempts")) as unknown as Collection<AttemptDoc>;
    const doc: Omit<AttemptDoc, "_id"> = {
      userId,
      assessmentId: assessmentMetaId,
      startedAt: new Date(),
      submittedAt: null,
      score: null,
      correct: null,
      wrong: null,
      skipped: null,
      prevLevel: null,
      newLevel: null,
      terminatedReason: null,
      violations: null,
      answers: null,
    };
    const inserted = await c.insertOne(doc as AttemptDoc);
    return {
      id: inserted.insertedId.toString(),
      userId,
      assessmentId: assessmentMetaId,
      startedAt: doc.startedAt,
      submittedAt: null,
      score: null,
      correct: null,
      wrong: null,
      skipped: null,
      prevLevel: null,
      newLevel: null,
      terminatedReason: null,
      violations: null,
      answers: null,
    };
  }

  async getAttempt(id: string): Promise<StoreAttempt | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = (await this.col("attempts")) as unknown as Collection<AttemptDoc>;
    return this.toAttempt(await c.findOne({ _id: new ObjectId(id) }));
  }

  async submitAttempt(
    id: string,
    payload: NewAttemptAnswers,
  ): Promise<StoreAttempt> {
    const c = (await this.col("attempts")) as unknown as Collection<AttemptDoc>;
    await c.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
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
      },
    );
    return (await this.getAttempt(id)) as StoreAttempt;
  }

  async listAttemptsByUser(
    userId: string,
    since?: Date,
  ): Promise<StoreAttemptWithMeta[]> {
    const ac = (await this.col("attempts")) as unknown as Collection<AttemptDoc>;
    const mc = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    const docs = await ac
      .find({
        userId,
        submittedAt: { $ne: null, ...(since ? { $gt: since } : {}) },
      })
      .sort({ submittedAt: -1 })
      .limit(200)
      .toArray();
    const out: StoreAttemptWithMeta[] = [];
    for (const d of docs) {
      const meta = await mc.findOne({ _id: new ObjectId(d.assessmentId) });
      if (!meta) continue;
      out.push({
        ...(this.toAttempt(d) as StoreAttempt),
        assessmentExternalId: meta.externalId,
        assessmentTitle: meta.title,
        assessmentCompetency: meta.competency,
        assessmentKind: toKind(meta.kind),
      });
    }
    return out;
  }

  async listSubmittedAttempts(opts: {
    since?: Date;
    department?: string | null;
    limit?: number;
  }): Promise<StoreFeedAttempt[]> {
    const ac = (await this.col("attempts")) as unknown as Collection<AttemptDoc>;
    const mc = (await this.col("assessmentMeta")) as unknown as Collection<AssessmentDoc>;
    const uc = (await this.col("users")) as unknown as Collection<UserDoc>;
    const docs = await ac
      .find({
        submittedAt: { $ne: null, ...(opts.since ? { $gt: opts.since } : {}) },
      })
      .sort({ submittedAt: -1 })
      .limit(opts.limit ?? 50)
      .toArray();
    const out: StoreFeedAttempt[] = [];
    for (const d of docs) {
      const meta = await mc.findOne({ _id: new ObjectId(d.assessmentId) });
      const user = await uc.findOne({ _id: new ObjectId(d.userId) });
      if (!meta || !user) continue;
      if (opts.department && user.department !== opts.department) continue;
      out.push({
        ...(this.toAttempt(d) as StoreAttempt),
        assessmentExternalId: meta.externalId,
        assessmentTitle: meta.title,
        assessmentCompetency: meta.competency,
        assessmentKind: toKind(meta.kind),
        userName: user.name,
        userEmail: user.email,
        userDepartment: user.department,
      });
    }
    return out;
  }

  // --- assignments ---

  private toAssignment(doc: AssignmentDoc | null): StoreAssignment | null {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toString(), ...rest };
  }

  async createAssignment(data: NewAssignment): Promise<StoreAssignment> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    const [author, assignee] = await Promise.all([
      this.getUserById(data.authorId),
      this.getUserById(data.assigneeId),
    ]);
    const doc: Omit<AssignmentDoc, "_id"> = {
      authorId: data.authorId,
      authorName: author?.name ?? null,
      assigneeId: data.assigneeId,
      assigneeName: assignee?.name ?? null,
      type: data.type,
      assessmentId: data.assessmentId ?? null,
      courseId: data.courseId ?? null,
      note: data.note ?? null,
      dueAt: data.dueAt ?? null,
      status: "PENDING",
      createdAt: new Date(),
      completedAt: null,
    };
    const inserted = await c.insertOne(doc as AssignmentDoc);
    return { id: inserted.insertedId.toString(), ...doc };
  }

  async getAssignment(id: string): Promise<StoreAssignment | null> {
    if (!ObjectId.isValid(id)) return null;
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    return this.toAssignment(await c.findOne({ _id: new ObjectId(id) }));
  }

  async updateAssignment(
    id: string,
    patch: { status?: StoreAssignmentStatus; completedAt?: Date | null },
  ): Promise<StoreAssignment> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    await c.updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...(patch.status ? { status: patch.status } : {}), ...(patch.completedAt !== undefined ? { completedAt: patch.completedAt } : {}) } },
    );
    return (await this.getAssignment(id)) as StoreAssignment;
  }

  async listAssignmentsForAssignee(
    assigneeId: string,
    since?: Date,
  ): Promise<StoreAssignment[]> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    const docs = await c
      .find({
        assigneeId,
        ...(since ? { createdAt: { $gt: since } } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => this.toAssignment(d) as StoreAssignment);
  }

  async listAssignmentsForAuthor(
    authorId: string,
    since?: Date,
  ): Promise<StoreAssignment[]> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    const docs = await c
      .find({
        authorId,
        ...(since ? { createdAt: { $gt: since } } : {}),
      })
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => this.toAssignment(d) as StoreAssignment);
  }

  async listAllAssignments(since?: Date): Promise<StoreAssignment[]> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    const docs = await c
      .find(since ? { createdAt: { $gt: since } } : {})
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();
    return docs.map((d) => this.toAssignment(d) as StoreAssignment);
  }

  async completeAssignmentsForAssessment(
    assigneeId: string,
    assessmentExternalId: string,
  ): Promise<StoreAssignment[]> {
    const c = (await this.col("assignments")) as unknown as Collection<AssignmentDoc>;
    const docs = await c
      .find({
        assigneeId,
        assessmentId: assessmentExternalId,
        status: { $in: ["PENDING", "STARTED"] },
      })
      .limit(50)
      .toArray();
    const updated: StoreAssignment[] = [];
    for (const d of docs) {
      await c.updateOne(
        { _id: d._id },
        { $set: { status: "COMPLETED", completedAt: new Date() } },
      );
      const fresh = await c.findOne({ _id: d._id });
      if (fresh) updated.push(this.toAssignment(fresh) as StoreAssignment);
    }
    return updated;
  }
}
