"use client";

/**
 * MyAssignmentsSection — live list of assignments the signed-in employee has
 * received from their trainer. Rendered at the top of the Employee Dashboard.
 *
 * - Sorted by due date (undated last), pending/in-progress first.
 * - "Start" deep-links: ASSESSMENT/EXAM enter the proctored quiz flow,
 *   COURSE navigates to the Learning page, LEARNING_PATH to the assess tab.
 * - New assignments slide in via the realtime event handler in
 *   AssignmentsProvider (prepend + toast) and get a "New" badge for 30s.
 */

import { useRef } from "react";
import { useT } from "@/lib/lang-context";
import { useAuth } from "@/lib/auth-context";
import {
  useAssignments,
  type ClientAssignment,
} from "@/lib/assignments-context";
import { useQuiz } from "@/components/saksham/quiz-context";
import { SectionTitle, EmptyState } from "@/components/saksham/primitives";
import { BookOpen, CalendarClock, ClipboardList, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";

function dueLabel(iso: string | null, t: (k: string) => string): string {
  if (!iso) return t("pages.noDueDate");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return t("pages.noDueDate");
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function typeIcon(type: ClientAssignment["type"]) {
  if (type === "COURSE") return <BookOpen size={16} />;
  if (type === "EXAM") return <MonitorPlay size={16} />;
  return <ClipboardList size={16} />;
}

function statusPillClass(status: ClientAssignment["status"]): string {
  switch (status) {
    case "COMPLETED":
      return "bg-[var(--teal-soft)] text-[var(--teal)]";
    case "STARTED":
      return "bg-[var(--warning-soft)] text-[#8a5a00]";
    case "EXPIRED":
      return "bg-[var(--critical-soft)] text-[var(--critical)]";
    default:
      return "bg-[var(--paper)] text-[var(--ink-soft)]";
  }
}

export function MyAssignmentsSection() {
  const t = useT();
  const { data } = useAuth();
  const { assignments, markStatus } = useAssignments();
  const quiz = useQuiz();

  // An assignment is "new" (slide-in highlight) when it was created after
  // this section mounted — i.e. it arrived live from the trainer. Derived
  // from createdAt, so no tracking state or effects are needed.
  const mountedAt = useRef(Date.now());
  const isNew = (a: ClientAssignment) =>
    new Date(a.createdAt).getTime() > mountedAt.current;

  if (!data) return null;

  const active = assignments
    .filter((a) => a.status === "PENDING" || a.status === "STARTED")
    .sort((a, b) => {
      const ad = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
      const bd = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
      return ad - bd;
    });
  const done = assignments.filter((a) => a.status === "COMPLETED").slice(0, 4);

  const start = (a: ClientAssignment) => {
    void markStatus(a.id, "STARTED");
    if ((a.type === "ASSESSMENT" || a.type === "EXAM") && a.assessmentId) {
      quiz.begin(a.assessmentId, a.type === "EXAM" ? "exam" : "assessment");
      return;
    }
    // COURSE → Learning page; LEARNING_PATH → Assess page.
    window.dispatchEvent(
      new CustomEvent("saksham:nav", {
        detail: a.type === "COURSE" ? "learning" : "assess",
      }),
    );
  };

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-6">
      <SectionTitle
        title={t("pages.myAssignments")}
        right={
          <span className="text-xs text-[var(--ink-soft)]">
            {active.length}
          </span>
        }
      />
      {active.length === 0 ? (
        <EmptyState message={t("pages.assignmentsEmpty")} />
      ) : (
        <div className="flex flex-col gap-3">
          {active.map((a) => {
            const title =
              a.type === "COURSE"
                ? (a.courseTitle ?? a.courseId ?? a.type)
                : (a.assessmentTitle ?? a.assessmentId ?? a.type);
            const fresh = isNew(a);
            return (
              <div
                key={a.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2.5 transition-all",
                  fresh && "saksham-slide-in border-[var(--teal)] bg-[var(--teal-soft)]",
                )}
              >
                <span className="text-[var(--navy)] shrink-0">
                  {typeIcon(a.type)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">
                      {title}
                    </span>
                    {fresh ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide bg-[var(--teal)] text-white rounded px-1.5 py-0.5">
                        {t("pages.newBadge")}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "text-[10px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5",
                        statusPillClass(a.status),
                      )}
                    >
                      {t(
                        a.status === "PENDING"
                          ? "pages.statusPending"
                          : a.status === "STARTED"
                            ? "pages.statusStarted"
                            : a.status === "COMPLETED"
                              ? "pages.statusCompleted"
                              : "pages.statusExpired",
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span>
                      {t("pages.assignedBy")} {a.authorName ?? "—"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock size={12} /> {t("pages.dueBy")}:{" "}
                      {dueLabel(a.dueAt, t)}
                    </span>
                    {a.note ? <span className="italic">{a.note}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => start(a)}
                  className="saksham-btn-primary h-9 px-3 text-sm shrink-0"
                >
                  {t("pages.startAssignment")}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {done.length > 0 ? (
        <div className="mt-3 pt-3 border-t border-[var(--line)] flex flex-wrap gap-2">
          {done.map((a) => (
            <span
              key={a.id}
              className="text-xs text-[var(--teal)] inline-flex items-center gap-1"
            >
              ✓{" "}
              {a.type === "COURSE"
                ? (a.courseTitle ?? a.courseId ?? a.type)
                : (a.assessmentTitle ?? a.assessmentId ?? a.type)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
