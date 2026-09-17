"use client";

/**
 * Quiz page — renders one question at a time, shows the proctor bar with the
 * live camera preview, and handles submit + back/next.
 */

import { useQuiz } from "@/components/saksham/quiz-context";
import { useProctor, useProctorVideo } from "@/components/saksham/proctor-context";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import { PageHeader, EmptyState } from "@/components/saksham/primitives";
import { cn } from "@/lib/utils";

export function QuizPage() {
  const quiz = useQuiz();
  const proctor = useProctor();
  const { data } = useAuth();
  const t = useT();
  const videoRef = useProctorVideo();

  if (!data || !quiz.assessmentId) {
    return <EmptyState message={t("pages.assessmentNotFound")} />;
  }

  const bank =
    quiz.kind === "exam" ? data.examQuestionBank : data.questionBank;
  const localMeta =
    quiz.kind === "exam"
      ? data.exams.find((a) => a.id === quiz.assessmentId)
      : data.assessments.find((a) => a.id === quiz.assessmentId);
  // Trainer-assigned AI-generated tests only exist in Mongo, not the static
  // seed JSON — fall back to the meta/paper the quiz context fetched from
  // the server when starting the attempt.
  const meta = localMeta ?? quiz.serverAssessment;
  if (!meta) {
    if (quiz.assessmentLoading) {
      return <EmptyState message="Loading assessment…" />;
    }
    return <EmptyState message={t("pages.assessmentNotFound")} />;
  }
  const questions = localMeta
    ? bank[quiz.assessmentId] || []
    : quiz.serverQuestions;
  if (questions.length === 0) {
    return <EmptyState message="No questions found for this assessment." />;
  }

  const idx = quiz.index;
  const q = questions[idx];
  const selected = quiz.answers[idx];
  const pct = ((idx + 1) / questions.length) * 100;
  const isLast = idx === questions.length - 1;
  const fullscreenWarn = !document.fullscreenElement;

  return (
    <>
      {/* Proctor bar — sticky at the top of the quiz */}
      {proctor.active && (
        <div className="sticky top-14 z-20 bg-[var(--navy)] text-white flex items-center gap-3 px-4 py-2 mb-4 rounded-lg">
          <span className="w-2.5 h-2.5 bg-[var(--critical)] rounded-full animate-pulse motion-reduce:animate-none" />
          <div className="w-12 h-9 bg-black rounded overflow-hidden grid place-items-center">
            {proctor.stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : null}
          </div>
          <div className="text-xs flex-1">
            {t("common.proctorSessionActive")} · {proctor.warningCount}/{proctor.maxWarnings} {t("common.proctorWarnings")}
          </div>
          {fullscreenWarn ? (
            <span className="text-xs bg-[var(--critical)] px-2 py-0.5 rounded">
              {t("common.proctorNotFullscreen")}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => quiz.exitTo("list")}
            className="text-xs bg-white/10 hover:bg-white/20 px-2.5 py-1 rounded"
          >
            {t("common.exit")}
          </button>
        </div>
      )}

      <PageHeader
        title={meta.title}
        subtitle={t("ui.questionOf", { current: idx + 1, total: questions.length })}
      />

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--paper)] rounded-full overflow-hidden mb-5 max-w-2xl">
        <div
          className="h-full bg-[var(--teal)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Question card */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-5 max-w-3xl">
        <div className="font-semibold text-base mb-4" id={`question-${idx}`}>
          {q.q}
        </div>
        {/* Options: keyboard users navigate with ArrowUp/ArrowDown and pick
           with Enter/Space (radiogroup semantics). */}
        <div
          className="flex flex-col gap-2"
          role="radiogroup"
          aria-labelledby={`question-${idx}`}
          onKeyDown={(e) => {
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            const buttons =
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "[role=radio]",
              );
            if (buttons.length === 0) return;
            const current = Array.from(buttons).findIndex(
              (b) => b === document.activeElement,
            );
            const delta = e.key === "ArrowDown" ? 1 : -1;
            const next =
              (current + delta + buttons.length) % buttons.length;
            buttons[next].focus();
          }}
        >
          {q.options.map((opt, i) => {
            const isSelected = selected === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected || (selected === null || selected === undefined) && i === 0 ? 0 : -1}
                onClick={() => quiz.setAnswer(idx, i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    quiz.setAnswer(idx, i);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition",
                  isSelected
                    ? "border-[var(--teal)] bg-[var(--teal-soft)]"
                    : "border-[var(--line)] bg-white hover:border-[var(--teal)] hover:bg-[var(--paper)]",
                )}
              >
                <span
                  className={cn(
                    "shrink-0 w-5 h-5 rounded-full grid place-items-center text-xs",
                    isSelected
                      ? "bg-[var(--teal)] text-white"
                      : "border border-[var(--line)] text-[var(--ink-soft)]",
                  )}
                >
                  {isSelected ? "●" : "○"}
                </span>
                <span className="text-sm">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t border-[var(--line)]">
          <button
            type="button"
            onClick={quiz.goBack}
            disabled={idx === 0}
            className="saksham-btn-secondary disabled:opacity-40"
          >
            {t("common.back")}
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={quiz.submit}
              disabled={selected === null || selected === undefined}
              className="saksham-btn-primary disabled:opacity-40"
            >
              {t("common.submit")}
            </button>
          ) : (
            <button
              type="button"
              onClick={quiz.goNext}
              disabled={selected === null || selected === undefined}
              className="saksham-btn-primary disabled:opacity-40"
            >
              {t("common.next")}
            </button>
          )}
        </div>
      </div>

      {/* Proctor toast — assertive so violations interrupt immediately */}
      {proctor.toast ? (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-[var(--navy)] text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50"
        >
          {proctor.toast}
        </div>
      ) : null}
    </>
  );
}
