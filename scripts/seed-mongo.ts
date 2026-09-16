/**
 * Seed MongoDB (Atlas or local) from the 5 prototype JSON files.
 * Idempotent — re-running upserts and never duplicates.
 *
 * Run: bun run db:seed:mongo   (requires MONGODB_URI in .env)
 */

import { MongoClient } from "mongodb";
import { buildSeedData } from "../src/lib/seed-source";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set — add it to .env (DATA_BACKEND=mongo).");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB ?? "saksham";
  console.log("Loaded URI:", process.env.MONGODB_URI);
  const client = new MongoClient(process.env.MONGODB_URI!);

  console.log(`Connecting to MongoDB (db: ${dbName})...`);
  await client.connect();
  const db = client.db(dbName);

  const usersCol = db.collection("users");
  const compCol = db.collection("competencies");
  const metaCol = db.collection("assessmentMeta");
  const qCol = db.collection("questions");
  const attCol = db.collection("attempts");

  const { users, competencies, assessments, questions, attempts } =
    await buildSeedData();

  const userIdByEmail = new Map<string, string>();

  for (const u of users) {
    const existing = await usersCol.findOne({ email: u.email });
    const doc = {
      email: u.email,
      passwordHash: u.passwordHash,
      name: u.name,
      role: u.role,
      designation: u.designation,
      department: u.department,
      organization: u.organization,
      location: u.location,
      yearsOfService: u.yearsOfService,
      reportsTo: u.reportsTo,
    };
    if (existing) {
      await usersCol.updateOne({ _id: existing._id }, { $set: doc });
      userIdByEmail.set(u.email, existing._id.toString());
    } else {
      const inserted = await usersCol.insertOne(doc as never);
      userIdByEmail.set(u.email, inserted.insertedId.toString());
    }
  }

  for (const c of competencies) {
    const userId = userIdByEmail.get(c.userEmail) as string;
    await compCol.updateOne(
      { userId, name: c.name },
      {
        $set: {
          current: c.current,
          required: c.required,
          evidence: c.evidence,
          category: c.category,
        },
      },
      { upsert: true },
    );
  }

  const metaIdByExternal = new Map<string, string>();
  for (const a of assessments) {
    const doc = {
      externalId: a.externalId,
      title: a.title,
      competency: a.competency,
      questions: a.questions,
      minutes: a.minutes,
      difficulty: a.difficulty,
      kind: a.kind,
      isPublished: true,
      authorId: null,
    };
    const res = await metaCol.updateOne(
      { externalId: a.externalId },
      { $set: doc },
      { upsert: true },
    );
    const id =
      res.upsertedId?.toString() ??
      (await metaCol.findOne({ externalId: a.externalId }))?._id?.toString();
    if (id) metaIdByExternal.set(a.externalId, id);
  }

  // Replace questions for each assessment only when counts differ (idempotent
  // but still correct if the bank changed between runs).
  for (const [externalId, metaId] of metaIdByExternal.entries()) {
    const bank = questions.filter((q) => q.assessmentExternalId === externalId);
    const count = await qCol.countDocuments({ assessmentId: metaId });
    if (count === bank.length && count > 0) {
      for (const q of bank) {
        await qCol.updateOne(
          { assessmentId: metaId, order: q.order },
          {
            $set: {
              text: q.text,
              options: JSON.stringify(q.options),
              correctIndex: q.correctIndex,
              explanation: q.explanation,
            },
          },
        );
      }
      continue;
    }
    await qCol.deleteMany({ assessmentId: metaId });
    if (bank.length > 0) {
      await qCol.insertMany(
        bank.map((q) => ({
          assessmentId: metaId,
          text: q.text,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          order: q.order,
        })),
      );
    }
  }

  // Historical attempts: only insert when the user has no attempt at all for
  // that assessment (keeps real submissions intact across re-seeds).
  for (const a of attempts) {
    const userId = userIdByEmail.get(a.userEmail);
    const metaId = metaIdByExternal.get(a.assessmentExternalId);
    if (!userId || !metaId) continue;
    const existing = await attCol.findOne({
      userId,
      assessmentId: metaId,
      score: a.score,
    });
    if (existing) continue;
    await attCol.insertOne({
      userId,
      assessmentId: metaId,
      startedAt: new Date(),
      submittedAt: new Date(),
      score: a.score,
      correct: a.correct,
      wrong: a.wrong,
      skipped: a.skipped,
      prevLevel: a.prevLevel,
      newLevel: a.newLevel,
      terminatedReason: null,
      violations: null,
      answers: null,
    });
  }

  console.log(
    `Mongo seed complete (${dbName}): ${users.length} users, ${competencies.length} competencies, ${assessments.length} assessments, ${questions.length} questions, ${attempts.length} historical attempts.`,
  );
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
