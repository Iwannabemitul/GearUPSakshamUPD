/**
 * Seed the SQLite database from the 5 prototype JSON files.
 * Idempotent — safe to re-run (upserts by unique keys).
 *
 * Run: bun run db:seed   (or: bunx tsx prisma/seed.ts)
 */

import { PrismaClient } from "@prisma/client";
import { buildSeedData } from "../src/lib/seed-source";

const db = new PrismaClient();

async function main() {
  const { users, competencies, assessments, questions, attempts } =
    await buildSeedData();

  const userIdByEmail = new Map<string, string>();

  for (const u of users) {
    const row = await db.user.upsert({
      where: { email: u.email },
      create: {
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
      },
      update: {
        passwordHash: u.passwordHash,
        name: u.name,
        role: u.role,
        designation: u.designation,
        department: u.department,
        organization: u.organization,
        location: u.location,
        yearsOfService: u.yearsOfService,
        reportsTo: u.reportsTo,
      },
    });
    userIdByEmail.set(u.email, row.id);
  }

  for (const c of competencies) {
    const userId = userIdByEmail.get(c.userEmail) as string;
    await db.competency.upsert({
      where: { userId_name: { userId, name: c.name } },
      create: {
        userId,
        name: c.name,
        current: c.current,
        required: c.required,
        evidence: c.evidence,
        category: c.category,
      },
      update: {
        current: c.current,
        required: c.required,
        evidence: c.evidence,
        category: c.category,
      },
    });
  }

  const metaIdByExternal = new Map<string, string>();
  for (const a of assessments) {
    const row = await db.assessmentMeta.upsert({
      where: { externalId: a.externalId },
      create: {
        externalId: a.externalId,
        title: a.title,
        competency: a.competency,
        questions: a.questions,
        minutes: a.minutes,
        difficulty: a.difficulty,
        kind: a.kind,
        isPublished: true,
      },
      update: {
        title: a.title,
        competency: a.competency,
        questions: a.questions,
        minutes: a.minutes,
        difficulty: a.difficulty,
        kind: a.kind,
      },
    });
    metaIdByExternal.set(a.externalId, row.id);
  }

  for (const q of questions) {
    const assessmentId = metaIdByExternal.get(q.assessmentExternalId);
    if (!assessmentId) continue;
    const existing = await db.question.findFirst({
      where: { assessmentId, order: q.order },
      select: { id: true },
    });
    if (existing) {
      await db.question.update({
        where: { id: existing.id },
        data: {
          text: q.text,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        },
      });
    } else {
      await db.question.create({
        data: {
          assessmentId,
          text: q.text,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          order: q.order,
        },
      });
    }
  }

  // Seed historical attempts only if none exist for the user yet (keeps
  // real submissions from being duplicated or overwritten on re-seed).
  for (const a of attempts) {
    const userId = userIdByEmail.get(a.userEmail);
    const metaId = metaIdByExternal.get(a.assessmentExternalId);
    if (!userId || !metaId) continue;
    const existing = await db.assessmentAttempt.findFirst({
      where: { userId, assessmentId: metaId, score: a.score },
      select: { id: true },
    });
    if (existing) continue;
    await db.assessmentAttempt.create({
      data: {
        userId,
        assessmentId: metaId,
        submittedAt: new Date(),
        score: a.score,
        correct: a.correct,
        wrong: a.wrong,
        skipped: a.skipped,
        prevLevel: a.prevLevel,
        newLevel: a.newLevel,
      },
    });
  }

  console.log(
    `Seed complete: ${users.length} users, ${competencies.length} competencies, ${assessments.length} assessments, ${questions.length} questions, ${attempts.length} historical attempts.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
