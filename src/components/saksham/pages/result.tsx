"use client";

/**
 * Assessment Result page — summary + per-question review tabs.
 *
 * Reads the last result from the QuizProvider and renders:
 *   - Score (animated count-up omitted for simplicity; replaced with a static
 *     big-number tile)
 *   - Competency level transition (previous → new)
 *   - Question breakdown pie chart (right / wrong / skipped)
 *   - Proctoring summary (if any violations or auto-submit)
 *   - Per-question review with explanations
 */

import { useState } from "react";
import { useQuiz } from "@/components/saksham/quiz-context";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import { PageHeader, EmptyState } from "@/components/saksham/primitives";
import { PieChart } from "@/components/saksham/charts";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, Circle, AlertTriangle, Download } from "lucide-react";
import { downloadCertificate } from "@/lib/certificate";
import { useToast } from "@/hooks/use-toast";

export function ResultPage() {
  const quiz = useQuiz();
  const { data } = useAuth();
  const t = useT();
  const { toast } = useToast();
  const [tab, setTab] = useState<"summary" | "review">("summary");
  const [certBusy, setCertBusy] = useState(false);

  const r = quiz.lastResult;
  if (!r || !data) {
    return (
      <>
        <PageHeader title={t("pages.resultTitle")} />
        <EmptyState message={t("pages.noResultFound")} />
      </>
    );
  }

  const downloadPdf = async () => {
    if (!r || !data) return;
    setCertBusy(true);
    try {
      await downloadCertificate({
        employeeName: data.employee.name,
        designation: data.employee.designation,
        department: data.employee.department,
        assessmentTitle: r.title,
        competency: r.competency,
        score: r.score,
        levelName: data.levelNames[r.newLevel] ?? `${r.newLevel}/5`,
        dateIso: new Date().toISOString(),
      });
    } catch {
      toast({ title: "Could not generate the PDF", variant: "destructive" });
    } finally {
      setCertBusy(false);
    }
  };

  const scoreColor =
    r.score >= 70
      ? "var(--good)"
      : r.score >= 50
        ? "var(--high)"
        : "var(--critical)";

  return (
    <>
      <PageHeader title={t("pages.resultTitle")} subtitle={r.title} />

      {/* Proctoring summary */}
      {r.violations.length > 0 || r.terminatedReason ? (
        <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-[var(--critical)]" />
            <div className="font-semibold text-sm">{t("common.proctoringSummary")}</div>
          </div>
          {r.terminatedReason ? (
            <div className="text-sm bg-[var(--critical-soft)] text-[var(--critical)] rounded-md px-3 py-2 mb-2">
              {t("common.proctorAutoSubmitted", { reason: r.terminatedReason })}
            </div>
          ) : null}
          <div className="space-y-1.5">
            {r.violations.map((v, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm py-1 border-b last:border-b-0 border-[var(--line)]"
              >
                <span>{v.reason}</span>
                <span className="text-xs text-[var(--ink-soft)]">{v.at}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["summary", "review"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition",
              tab === k
                ? "bg-[var(--teal)] text-white"
                : "bg-white text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--teal)]",
            )}
          >
            {k === "summary" ? t("common.summary") : t("common.reviewAnswers")}
          </button>
        ))}
      </div>

      {tab === "summary" ? (
        <>
          {/* Score + Level transition */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[var(--line)] p-5">
              <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide">
                {t("ui.assessmentScore")}
              </div>
              <div
                role="status"
                aria-live="polite"
                className="text-5xl font-semibold mt-1"
                style={{ color: scoreColor }}
              >
                {r.score}%
              </div>
              <div className="text-sm text-[var(--ink-soft)] mt-1">
                {r.correct} of {r.total} {t("ui.correct")}
              </div>
              {r.serverSynced ? (
                <div className="text-xs text-[var(--teal)] mt-2 inline-flex items-center gap-1.5 bg-[var(--teal-soft)] rounded-md px-2 py-1">
                  <CheckCircle2 size={13} />
                  {t("pages.trainerNotified")}
                </div>
              ) : null}
            </div>
            <div className="bg-white rounded-xl border border-[var(--line)] p-5">
              <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide mb-2">
                {t("ui.competencyLevel")}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>
                  {t("common.previous")}:{" "}
                  <strong>{data.levelNames[r.prevLevel]}</strong>
                </span>
                <span className="text-[var(--ink-soft)]">→</span>
                <span>
                  {t("ui.updated")}:{" "}
                  <strong style={{ color: "var(--teal)" }}>
                    {data.levelNames[r.newLevel]}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          {/* Question breakdown */}
          <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4">
            <div className="font-semibold text-sm mb-3">
              {t("common.questionBreakdown")}
            </div>
            <PieChart
              segments={[
                {
                  label: t("common.resultRight"),
                  value: r.correct,
                  color: "#2F6F4F",
                },
                {
                  label: t("common.resultWrong"),
                  value: r.wrong,
                  color: "#A63D2F",
                },
                {
                  label: t("common.resultSkipped"),
                  value: r.skipped,
                  color: "#8FA0AE",
                },
              ]}
            />
          </div>

          {/* Strengths + Improvement areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-xl border border-[var(--line)] p-4">
              <div className="font-semibold text-sm text-[var(--good)] mb-2">
                {t("ui.areasOfStrength")}
              </div>
              <div className="text-sm text-[var(--ink-soft)]">
                {t("ui.solidGrasp", { skill: r.competency })}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[var(--line)] p-4">
              <div className="font-semibold text-sm text-[var(--high)] mb-2">
                {t("ui.areasNeedingImprovement")}
              </div>
              <div className="text-sm text-[var(--ink-soft)]">
                {r.newLevel < 4
                  ? t("ui.continueBuilding", {
                      skill: r.competency,
                      level: data.levelNames[Math.min(5, r.newLevel + 1)],
                    })
                  : t("ui.noMajorGaps")}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => quiz.exitTo("list")}
              className="saksham-btn-secondary"
            >
              {t("ui.viewProgress")}
            </button>
            <button
              type="button"
              onClick={() => quiz.exitTo("list")}
              className="saksham-btn-primary"
            >
              {t("ui.nextRecommendation")}
            </button>
            <button
              type="button"
              onClick={() => void downloadPdf()}
              disabled={certBusy}
              className="saksham-btn-secondary inline-flex items-center gap-1.5"
            >
              <Download size={14} />
              {certBusy ? "…" : "Download PDF"}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {r.questionReview.map((q, i) => {
            const skipped = q.userIndex === -1;
            const isCorrect = !skipped && q.userIndex === q.correctIndex;
            return (
              <div
                key={i}
                className="bg-white rounded-xl border border-[var(--line)] p-4"
              >
                <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide mb-1">
                  {t("ui.questionOf", { current: i + 1, total: r.questionReview.length })}
                </div>
                <div className="font-semibold text-sm mb-3">{q.question}</div>

                {q.options.map((opt, oi) => {
                  const isCorrectOption = oi === q.correctIndex;
                  const isUserPick = oi === q.userIndex;
                  return (
                    <div
                      key={oi}
                      className={cn(
                        "flex items-start gap-2.5 px-3 py-2 rounded-md text-sm mb-1.5 border",
                        isCorrectOption
                          ? "border-[var(--good)] bg-[var(--good-soft)]"
                          : isUserPick
                            ? "border-[var(--critical)] bg-[var(--critical-soft)]"
                            : "border-[var(--line)]",
                      )}
                    >
                      <span className="shrink-0 mt-0.5">
                        {isCorrectOption ? (
                          <CheckCircle2 size={14} className="text-[var(--good)]" />
                        ) : isUserPick ? (
                          <XCircle size={14} className="text-[var(--critical)]" />
                        ) : (
                          <Circle size={14} className="text-[var(--ink-soft)]" />
                        )}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isCorrectOption ? (
                        <span className="text-xs text-[var(--good)] font-medium shrink-0">
                          {isUserPick
                            ? `${t("common.yourAnswer")} · ${t("common.correctAnswer")}`
                            : t("common.correctAnswer")}
                        </span>
                      ) : isUserPick ? (
                        <span className="text-xs text-[var(--critical)] font-medium shrink-0">
                          {t("common.yourAnswer")}
                        </span>
                      ) : null}
                    </div>
                  );
                })}

                {skipped ? (
                  <div className="text-xs text-[var(--medium)] bg-[var(--medium-soft)] rounded-md px-3 py-1.5 mt-2">
                    {t("common.skipped")}
                  </div>
                ) : null}

                {!isCorrect && q.explanation ? (
                  <div className="mt-3 pt-3 border-t border-[var(--line)]">
                    <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide mb-1">
                      {t("common.whyCorrect")}
                    </div>
                    <div className="text-sm text-[var(--ink-soft)]">
                      {q.explanation}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
