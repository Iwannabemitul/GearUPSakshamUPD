/**
 * /api/assessments/attempts/:id/submit — submit an attempt.
 *
 * The server re-scores the submitted option indices against the stored
 * question bank (client answers are never trusted for scoring), applies the
 * competency level heuristic, persists the attempt, updates the user's
 * competency level and fans the result out to trainers/admins.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";
import { fanout } from "@/lib/fanout";
import { nextLevel, scoreAttempt } from "@/lib/scoring";
import { regenerateProfileSummary } from "@/lib/ai-profile-summary";

type SubmitBody = {
  answers?: Array<{ questionId: string; userIndex: number }>;
  violations?: Array<{ reason: string; at: string }>;
  terminatedReason?: string | null;
};

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const { id } = await ctx.params;

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }
  const answers = Array.isArray(body.answers) ? body.answers : [];
  const violations = Array.isArray(body.violations)
    ? body.violations
    : [];

  const store = getStore();
  const attempt = await store.getAttempt(id);
  if (!attempt) return jsonError("Attempt not found", 404);
  if (attempt.userId !== session.userId) {
    return jsonError("You can only submit your own attempt", 403);
  }
  if (attempt.submittedAt) {
    return jsonError("Attempt already submitted", 409);
  }

  const meta = await store.getAssessmentMetaById(attempt.assessmentId);
  if (!meta) return jsonError("Assessment metadata missing", 500);

  const questions = await store.getQuestions(attempt.assessmentId);
  const scored = scoreAttempt(questions, answers);

  const comps = await store.getCompetencies(session.userId);
  const comp = comps.find((c) => c.name === meta.competency);
  const prevLevel = comp?.current ?? 1;
  const newLevel = nextLevel(scored.score, prevLevel);

  const submitted = await store.submitAttempt(id, {
    answers,
    violations,
    terminatedReason: body.terminatedReason ?? null,
    score: scored.score,
    correct: scored.correct,
    wrong: scored.wrong,
    skipped: scored.skipped,
    prevLevel,
    newLevel,
  });

  if (comp && newLevel !== prevLevel) {
    await store.updateCompetencyLevel(session.userId, meta.competency, newLevel);
  }

  // Auto-complete any assignment the trainer gave for this assessment.
  const completedAssignments = await store.completeAssignmentsForAssessment(
    session.userId,
    meta.externalId,
  );

  void fanout("assessment:submitted", {
    attemptId: submitted.id,
    userId: session.userId,
    userName: session.name,
    userDepartment: session.department,
    assessmentExternalId: meta.externalId,
    assessmentTitle: meta.title,
    assessmentCompetency: meta.competency,
    kind: meta.kind,
    score: scored.score,
    correct: scored.correct,
    wrong: scored.wrong,
    skipped: scored.skipped,
    prevLevel,
    newLevel,
    terminatedReason: body.terminatedReason ?? null,
    violationCount: violations.length,
  }, [
    `dept:${session.department ?? "unknown"}`,
    "role:trainer",
    "role:admin",
  ]);

  if (newLevel !== prevLevel) {
    void fanout("competency:updated", {
      userId: session.userId,
      userName: session.name,
      competency: meta.competency,
      prevLevel,
      newLevel,
    }, [
      `dept:${session.department ?? "unknown"}`,
      "role:trainer",
    ]);
  }

  for (const a of completedAssignments) {
    void fanout("assignment:updated", a, [
      `user:${a.assigneeId}`,
      `user:${a.authorId}`,
    ]);
  }

  // Fire-and-forget: regenerate the cached whole-profile AI summary using
  // this new attempt plus all prior history. Never blocks the response —
  // if the ai-service is slow/down, the Result page just shows the
  // previous cached summary (or none) until the next successful run.
  void regenerateProfileSummary(store, session.userId, submitted.id);

  return Response.json({
    attempt: submitted,
    assessment: {
      externalId: meta.externalId,
      title: meta.title,
      competency: meta.competency,
      kind: meta.kind,
    },
    result: {
      score: scored.score,
      correct: scored.correct,
      wrong: scored.wrong,
      skipped: scored.skipped,
      prevLevel,
      newLevel,
    },
    review: scored.review,
  });
}
