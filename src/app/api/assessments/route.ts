/**
 * /api/assessments — publish a generated assessment (Workstream C.4).
 * Trainers/admins only. Body: { title, competency, minutes?, difficulty?,
 * kind?, questions: [{q, options, answer, explanation}] }
 * The server assigns an externalId (g-<slug>-<rand>) and stores the bank;
 * the assessment then appears to employees via the normal start/submit flow.
 */

import { getStore } from "@/lib/store";
import { getSessionOrNull, jsonError } from "@/lib/auth";
import { fanout } from "@/lib/fanout";

type Body = {
  title?: string;
  competency?: string;
  minutes?: number;
  difficulty?: string;
  kind?: string;
  questions?: Array<{
    q?: string;
    options?: string[];
    answer?: number;
    explanation?: string;
  }>;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

export async function POST(req: Request) {
  const session = await getSessionOrNull();
  if (!session) return jsonError("Unauthorized", 401);
  if (session.role === "employee") {
    return jsonError("Only trainers and admins can publish assessments", 403);
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const title = (body.title ?? "").trim();
  const competency = (body.competency ?? "").trim();
  const questions = (body.questions ?? []).filter(
    (q) =>
      typeof q.q === "string" &&
      q.q.trim().length > 0 &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      Number.isInteger(q.answer) &&
      (q.answer as number) >= 0 &&
      (q.answer as number) < (q.options?.length ?? 0),
  );

  if (!title || !competency) {
    return jsonError("title and competency are required", 400);
  }
  if (questions.length === 0) {
    return jsonError("at least one valid question is required", 400);
  }

  const store = getStore();
  const externalId = `g-${slugify(title)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;

  const meta = await store.createGeneratedAssessment(
    {
      externalId,
      title,
      competency,
      questions: questions.length,
      minutes: Number(body.minutes) || Math.max(5, questions.length * 3),
      difficulty: body.difficulty || "Intermediate",
      kind: body.kind === "EXAM" ? "EXAM" : "CHECKPOINT",
    },
    questions.map((q) => ({
      text: q.q as string,
      options: q.options as string[],
      correctIndex: q.answer as number,
      explanation: q.explanation ?? "",
    })),
    session.userId,
  );

  void fanout("assessment:started", {
    published: true,
    assessmentExternalId: meta.externalId,
    assessmentTitle: meta.title,
    authorName: session.name,
  }, ["role:trainer", "role:admin"]);

  return Response.json({ assessment: meta }, { status: 201 });
}
