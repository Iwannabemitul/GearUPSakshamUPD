/**
 * /api/assessments/:externalId/start — begin an assessment attempt.
 * Creates the attempt row and returns the full question paper WITHOUT the
 * correct answers (the server keeps those for authoritative scoring).
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";
import { fanout } from "@/lib/fanout";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ externalId: string }> },
) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);

  const { externalId } = await ctx.params;
  const store = getStore();
  const meta = await store.getAssessmentMetaByExternalId(externalId);
  if (!meta) return jsonError("Assessment not found", 404);

  const attempt = await store.createAttempt(session.userId, meta.id);
  const questions = await store.getQuestions(meta.id);

  void fanout("assessment:started", {
    attemptId: attempt.id,
    userId: session.userId,
    userName: session.name,
    assessmentExternalId: meta.externalId,
    assessmentTitle: meta.title,
    kind: meta.kind,
  }, [
    `dept:${session.department ?? "unknown"}`,
    "role:trainer",
  ]);

  return Response.json({
    attemptId: attempt.id,
    startedAt: attempt.startedAt,
    assessment: {
      externalId: meta.externalId,
      title: meta.title,
      competency: meta.competency,
      questions: meta.questions,
      minutes: meta.minutes,
      difficulty: meta.difficulty,
      kind: meta.kind,
    },
    paper: questions.map((q, i) => ({
      index: i,
      questionId: q.id,
      text: q.text,
      options: q.options,
    })),
  });
}
