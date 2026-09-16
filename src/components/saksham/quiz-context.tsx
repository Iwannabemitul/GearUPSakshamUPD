"use client";

/**
 * QuizProvider — owns the active assessment's state machine.
 *
 * Lifecycle:
 *   1. User clicks "Start assessment" on the Assess/Exam tab → calls
 *      `begin(assessmentId, kind)` which sets up the proctor check phase
 *      and flips the page to 'proctor-check'.
 *   2. User passes the proctor check and clicks "Enter fullscreen & start" →
 *      the proctor becomes active and the page flips to 'quiz'.
 *   3. User answers questions (or triggers an auto-submit via proctor
 *      termination) → `submit()` computes the score locally, builds the
 *      result bundle, and flips the page to 'result'.
 *   4. The Result page reads `state.lastResult` and renders the summary +
 *      per-question review.
 *
 * Scoring is done client-side against the question bank loaded from
 * assessments.json — no server round-trip needed.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import { useProctor } from "@/components/saksham/proctor-context";
import type {
  AssessmentHistoryEntry,
  AssessmentMeta,
  Question,
} from "@/lib/data";

export type QuizKind = "assessment" | "exam";

type QuizPage = "list" | "proctor-check" | "quiz" | "result";

export type QuizResult = {
  assessmentId: string;
  kind: QuizKind;
  title: string;
  competency: string;
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
  prevLevel: number;
  newLevel: number;
  questionReview: Array<{
    question: string;
    options: string[];
    correctIndex: number;
    userIndex: number;
    explanation: string;
  }>;
  terminatedReason: string | null;
  violations: Array<{ reason: string; at: string }>;
  /** True when the server persisted the attempt (trainer got notified). */
  serverSynced: boolean;
};

type QuizContextValue = {
  page: QuizPage;
  assessmentId: string | null;
  kind: QuizKind;
  index: number;
  answers: (number | null)[];
  lastResult: QuizResult | null;
  // History (per-session, in-memory)
  assessmentHistory: AssessmentHistoryEntry[];
  examHistory: AssessmentHistoryEntry[];
  begin: (assessmentId: string, kind?: QuizKind) => void;
  setAnswer: (i: number, opt: number) => void;
  goNext: () => void;
  goBack: () => void;
  submit: () => void;
  exitTo: (page: QuizPage) => void;
};

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({ children }: { children: ReactNode }) {
  const { data, session } = useAuth();
  const proctor = useProctor();

  const [page, setPage] = useState<QuizPage>("list");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [kind, setKind] = useState<QuizKind>("assessment");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);
  const [assessmentHistory, setAssessmentHistory] = useState<
    AssessmentHistoryEntry[]
  >([]);
  const [examHistory, setExamHistory] = useState<AssessmentHistoryEntry[]>([]);

  // Server-side attempt bookkeeping (Workstream A): begin() asks the API to
  // open an attempt; submit() posts the answers so the server can re-score
  // authoritatively and notify the trainer. If the API is unreachable the
  // quiz still works and the result simply won't be persisted.
  const attemptIdRef = useRef<string | null>(null);
  const paperRef = useRef<Array<{ questionId: string }> | null>(null);
  const hydratedRef = useRef<string | null>(null);

  // Hydrate persisted history from the server once per signed-in email so
  // the Progress page survives refreshes (Workstream C.3 via A).
  useEffect(() => {
    const email = session?.email;
    if (!email || !data) return;
    if (hydratedRef.current === email) return;
    hydratedRef.current = email;
    void (async () => {
      try {
        const res = await fetch("/api/users/me/attempts");
        if (!res.ok) return;
        const payload = (await res.json()) as {
          attempts: Array<{
            id: string;
            assessmentExternalId: string;
            assessmentTitle: string;
            assessmentCompetency: string;
            assessmentKind: "CHECKPOINT" | "EXAM";
            score: number | null;
            correct: number | null;
            wrong: number | null;
            skipped: number | null;
            prevLevel: number | null;
            newLevel: number | null;
          }>;
        };
        const metaFor = (externalId: string, k: QuizKind) => {
          const list = k === "exam" ? data.exams : data.assessments;
          return list.find((a) => a.id === externalId);
        };
        const toEntries = (
          k: QuizKind,
        ): AssessmentHistoryEntry[] =>
          payload.attempts
            .filter((a) => a.score !== null)
            .filter((a) => (a.assessmentKind === "EXAM" ? "exam" : "assessment") === k)
            .map((a) => {
              const meta =
                metaFor(a.assessmentExternalId, k) ??
                ({
                  id: a.assessmentExternalId,
                  title: a.assessmentTitle,
                  competency: a.assessmentCompetency,
                  questions: 0,
                  minutes: 0,
                  difficulty: "—",
                } as AssessmentMeta);
              return {
                assessment: meta,
                score: a.score ?? 0,
                correct: a.correct ?? undefined,
                wrong: a.wrong ?? undefined,
                skipped: a.skipped ?? undefined,
                prevLevel: a.prevLevel ?? 1,
                newLevel: a.newLevel ?? 1,
              } as AssessmentHistoryEntry;
            });
         
        setAssessmentHistory(toEntries("assessment"));
         
        setExamHistory(toEntries("exam"));
      } catch {
        /* offline — session-local history only */
      }
    })();
  }, [session?.email, data]);

  const begin = useCallback(
    (id: string, k: QuizKind = "assessment") => {
      setAssessmentId(id);
      setKind(k);
      setIndex(0);
      setAnswers([]);
      setLastResult(null);
      proctor.beginCheck(id, k);
      setPage("proctor-check");

      // Ask the server to open an attempt (best-effort).
      attemptIdRef.current = null;
      paperRef.current = null;
      void (async () => {
        try {
          const res = await fetch(`/api/assessments/${id}/start`, {
            method: "POST",
          });
          if (!res.ok) return;
          const payload = (await res.json()) as {
            attemptId: string;
            paper: Array<{ questionId: string }>;
          };
          attemptIdRef.current = payload.attemptId;
          paperRef.current = payload.paper;
        } catch {
          /* offline attempt — result won't persist */
        }
      })();
    },
    [proctor],
  );

  const setAnswer = useCallback((i: number, opt: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[i] = opt;
      return next;
    });
  }, []);

  const goNext = useCallback(() => setIndex((i) => i + 1), []);
  const goBack = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  const exitTo = useCallback((target: QuizPage) => {
    proctor.exitQuiz();
    setPage(target);
  }, [proctor]);

  const submit = useCallback(async () => {
    if (!data || !assessmentId || !session) return;

    const bank: Record<string, Question[]> =
      kind === "exam" ? data.examQuestionBank : data.questionBank;
    const meta =
      kind === "exam"
        ? data.exams.find((a) => a.id === assessmentId)
        : data.assessments.find((a) => a.id === assessmentId);
    if (!meta) return;
    const questions = bank[assessmentId] || [];

    // Score
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    const review: QuizResult["questionReview"] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[i];
      if (a === null || a === undefined) {
        skipped++;
      } else if (a === q.answer) {
        correct++;
      } else {
        wrong++;
      }
      review.push({
        question: q.q,
        options: q.options,
        correctIndex: q.answer,
        userIndex: a ?? -1,
        explanation: q.explanation,
      });
    }
    const total = questions.length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    // Update competency level (very simple heuristic: 70%+ = +1 level, capped at 5)
    const competency = data.competencies.find(
      (c) => c.name === meta.competency,
    );
    const prevLevel = competency?.current ?? 1;
    let newLevel = prevLevel;
    if (score >= 70) {
      newLevel = Math.min(5, prevLevel + 1);
    } else if (score < 30) {
      newLevel = Math.max(1, prevLevel - 1);
    }

    const result: QuizResult = {
      assessmentId,
      kind,
      title: meta.title,
      competency: meta.competency,
      total,
      correct,
      wrong,
      skipped,
      score,
      prevLevel,
      newLevel,
      questionReview: review,
      terminatedReason: proctor.terminatedReason,
      violations: proctor.violations,
      serverSynced: false,
    };

    // Server submission: the server re-scores authoritatively, applies the
    // competency transition, persists the attempt and fans the event out to
    // the trainer's dashboard. Fire-and-await with a short timeout — the UI
    // already has its local result and will render regardless.
    const attemptId = attemptIdRef.current;
    if (attemptId) {
      try {
        const answersForServer = questions.map((q, i) => ({
          questionId: paperRef.current?.[i]?.questionId ?? `idx:${i}`,
          userIndex: answers[i] ?? -1,
        }));
        const controller = new AbortController();
        const abortTimer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`/api/assessments/attempts/${attemptId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: answersForServer,
            violations: proctor.violations,
            terminatedReason: proctor.terminatedReason,
          }),
          signal: controller.signal,
        });
        clearTimeout(abortTimer);
        if (res.ok) {
          const payload = (await res.json()) as {
            result: { score: number; correct: number; wrong: number; skipped: number; prevLevel: number; newLevel: number };
            review: QuizResult["questionReview"];
          };
          result.score = payload.result.score;
          result.correct = payload.result.correct;
          result.wrong = payload.result.wrong;
          result.skipped = payload.result.skipped;
          result.prevLevel = payload.result.prevLevel;
          result.newLevel = payload.result.newLevel;
          result.questionReview = payload.review;
          result.serverSynced = true;
        }
      } catch {
        /* server unreachable — local result stands, not persisted */
      }
    }

    // Persist to history
    const historyEntry: AssessmentHistoryEntry = {
      assessment: meta,
      score,
      correct,
      wrong,
      skipped,
      prevLevel,
      newLevel,
      aiReport: undefined,
      questionReview: questions.map((q) => ({
        q: q.q,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
      })),
    };
    if (kind === "exam") {
      setExamHistory((h) => [...h, historyEntry]);
    } else {
      setAssessmentHistory((h) => [...h, historyEntry]);
    }

    // Update competency in-memory (so the dashboard reflects the new level)
    if (competency && newLevel !== prevLevel) {
      competency.current = newLevel;
      competency.lastAssessed = "Just now";
    }

    setLastResult(result);
    proctor.endExam();
    setPage("result");
  }, [data, session, assessmentId, kind, answers, proctor]);

  // When the proctor becomes terminated (too many violations), auto-submit.
  // We use a ref to avoid calling setState synchronously inside the effect —
  // instead we schedule the submit on the next tick. The ref is updated in
  // its own effect (not during render) so React Compiler doesn't complain.
  const submitRef = useRef<() => void>(() => {});
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);
  useEffect(() => {
    if (proctor.active && proctor.terminated && page === "quiz") {
      // Defer to next tick so we're not calling setState inside an effect.
      const id = setTimeout(() => submitRef.current(), 0);
      return () => clearTimeout(id);
    }
  }, [proctor.terminated, proctor.active, page]);

  const value = useMemo<QuizContextValue>(
    () => ({
      page,
      assessmentId,
      kind,
      index,
      answers,
      lastResult,
      assessmentHistory,
      examHistory,
      begin,
      setAnswer,
      goNext,
      goBack,
      submit,
      exitTo,
    }),
    [
      page,
      assessmentId,
      kind,
      index,
      answers,
      lastResult,
      assessmentHistory,
      examHistory,
      begin,
      setAnswer,
      goNext,
      goBack,
      submit,
      exitTo,
    ],
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuiz() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuiz must be used inside <QuizProvider>");
  return ctx;
}
