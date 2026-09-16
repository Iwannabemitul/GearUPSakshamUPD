/**
 * Server-authoritative scoring for assessment submissions.
 *
 * Mirrors the client heuristic in quiz-context.tsx exactly so the UI stays
 * consistent, but the server's numbers win: the client posts its selected
 * option indices and the server re-scores against the stored question bank.
 */

import type { StoreQuestion } from "@/lib/store";

export type ScoredAttempt = {
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  review: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    userIndex: number;
    explanation: string;
  }>;
};

export function scoreAttempt(
  questions: StoreQuestion[],
  answers: Array<{ questionId: string; userIndex: number }>,
): ScoredAttempt {
  const byId = new Map(answers.map((a) => [a.questionId, a.userIndex]));
  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  const review: ScoredAttempt["review"] = [];

  for (const q of questions) {
    const userIndex = byId.get(q.id);
    const picked =
      userIndex === undefined || userIndex === null || userIndex < 0
        ? null
        : userIndex;
    if (picked === null) skipped++;
    else if (picked === q.correctIndex) correct++;
    else wrong++;
    review.push({
      question: q.text,
      options: q.options,
      correctIndex: q.correctIndex,
      userIndex: picked === null ? -1 : picked,
      explanation: q.explanation ?? "",
    });
  }

  const total = questions.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { correct, wrong, skipped, score, review };
}

/** Competency level transition — identical heuristic to quiz-context.tsx. */
export function nextLevel(score: number, prevLevel: number): number {
  let level = prevLevel;
  if (score >= 70) level = Math.min(5, prevLevel + 1);
  else if (score < 30) level = Math.max(1, prevLevel - 1);
  return level;
}
