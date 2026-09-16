"use client";

/**
 * Employee-facing pages for Saksham.
 *
 * Each page is a React component consuming the shared useAuth() + useT() hooks.
 * Per the user's "remove unnecessary boxes" mandate we condense the original
 * 6-tile KPI grid into 3 high-signal tiles, flatten nested card structures,
 * and drop decorative section wrappers around single items.
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang, useT } from "@/lib/lang-context";
import {
  PageHeader,
  SectionTitle,
  Pill,
  PriorityPill,
  LevelBar,
  EmptyState,
  KeyValue,
} from "@/components/saksham/primitives";
import { RadarChart, BarChart, LineChart, PieChart } from "@/components/saksham/charts";
import { IGOT_COURSES } from "@/lib/igot-courses";
import {
  BookOpen,
  Clock,
  ListChecks,
  Target,
  ArrowRight,
  CheckCircle2,
  Circle,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProctor } from "../proctor-context";
import { useQuiz } from "../quiz-context";
import { MyAssignmentsSection } from "@/components/saksham/assignments-section";

/* ============================ Dashboard ============================ */

export function EmployeeDashboard() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const cs = data.competencies;
  const gaps = cs
    .map((c) => ({
      ...c,
      gap: c.required - c.current,
      priority: priorityForGap(c.required - c.current),
    }))
    .filter((c) => c.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  const critical = gaps
    .filter((x) => x.priority === "Critical" || x.priority === "High")
    .slice(0, 4);
  const avg = (cs.reduce((s, c) => s + c.current, 0) / cs.length).toFixed(1);
  const radarData = cs.slice(0, 7).map((c) => ({
    label: c.name,
    current: c.current,
    required: c.required,
  }));

  // Top KPIs — condensed from 6 down to 3 (overall + critical + assessments).
  const kpis = [
    {
      label: t("common.overallCompetency"),
      value: `${avg} / 5`,
      sub: t("ui.acrossTrackedCompetencies"),
      accent: "var(--navy)",
    },
    {
      label: t("common.criticalHighGaps"),
      value: gaps.filter((g) => ["Critical", "High"].includes(g.priority)).length,
      sub: t("ui.needPriorityAttention"),
      accent: "var(--critical)",
    },
    {
      label: t("common.assessmentsCompletedLabel"),
      value: `${data.assessmentsDone.length}`,
      sub: `${t("ui.available")}: ${data.assessments.length}`,
      accent: "var(--teal)",
    },
  ];

  // Recommended courses — pulled from the new IGOT_COURSES catalog mapped to
  // the user's actual competency gaps.
  const gapNames = new Set(gaps.map((g) => g.name));
  const recommendedCourses = IGOT_COURSES.filter(
    (c) =>
      gapNames.has(c.competency) ||
      (c.competency === "AI/ML" && gapNames.has("Python")),
  ).slice(0, 3);

  return (
    <>
      <PageHeader
        title={`${t("pages.welcome")}, ${data.employee.name}`}
        subtitle={`${data.employee.designation} · ${data.employee.department} · ${data.employee.organization}`}
      />

      {/* Live assignments from the trainer (Workstream A) */}
      <MyAssignmentsSection />

      {/* KPI row — 3 tiles instead of 6 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {kpis.map((k, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[var(--line)] p-4 relative overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1"
              style={{ background: k.accent }}
            />
            <div className="text-xs text-[var(--ink-soft)] uppercase tracking-wide">
              {k.label}
            </div>
            <div className="text-3xl font-semibold text-[var(--navy)] mt-1">
              {k.value}
            </div>
            {k.sub ? (
              <div className="text-xs text-[var(--ink-soft)] mt-1">{k.sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* Radar + Upcoming assessment — two-column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-[var(--line)] p-4">
          <SectionTitle
            title={t("ui.competencyOverview")}
            right={<span className="text-xs text-[var(--ink-soft)]">{t("ui.currentVsRequired")}</span>}
          />
          <RadarChart data={radarData} />
        </div>

        <div className="bg-white rounded-xl border border-[var(--line)] p-4">
          <SectionTitle title={t("ui.upcomingAssessment")} />
          <div className="font-semibold text-base">
            {t("ui.assessment")} · {t("ui.checkpoint")}
          </div>
          <div className="text-sm text-[var(--ink-soft)] mt-1">
            {t("ui.linkedCurrentLearningPhase")}
          </div>
          <div className="flex gap-4 text-sm text-[var(--ink-soft)] mt-3">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> 12 {t("ui.min")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ListChecks size={14} /> 4 {t("ui.questions")}
            </span>
          </div>
          <a
            href="#assess"
            onClick={(e) => {
              e.preventDefault();
              window.dispatchEvent(
                new CustomEvent("saksham:nav", { detail: "assess" }),
              );
            }}
            className="saksham-btn-primary w-full mt-4 h-10"
          >
            {t("ui.goToAssessments")}
          </a>
        </div>
      </div>

      {/* Priority gaps */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-6">
        <SectionTitle
          title={t("pages.dashboardPriorityGaps")}
          right={
            <a
              href="#gaps"
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(
                  new CustomEvent("saksham:nav", { detail: "gaps" }),
                );
              }}
              className="saksham-link text-sm"
            >
              {t("common.viewAll")} →
            </a>
          }
        />
        {critical.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {critical.map((g) => (
              <div
                key={g.name}
                className="border-l-4 pl-3 py-2"
                style={{ borderColor: priorityFg(g.priority) }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{g.name}</div>
                  <PriorityPill priority={g.priority} />
                </div>
                <div className="text-xs text-[var(--ink-soft)] mt-1">
                  {t("common.current")}: {data.levelNames[g.current]} ·{" "}
                  {t("common.required")}: {data.levelNames[g.required]}
                </div>
                <div className="mt-2">
                  <LevelBar current={g.current} required={g.required} compact />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={t("pages.noGapsRemaining")} />
        )}
      </div>

      {/* Recommended learning — iGOT Karmayogi courses */}
      <div className="bg-white rounded-xl border border-[var(--line)] p-4">
        <SectionTitle title={t("pages.dashboardRecommendedLearning")} />
        {recommendedCourses.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recommendedCourses.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-[var(--line)] p-3 hover:border-[var(--teal)] transition"
              >
                <div className="text-xs font-semibold text-[var(--teal)] uppercase tracking-wide">
                  {c.track}
                </div>
                <div className="font-semibold text-sm mt-1 line-clamp-2">
                  {c.title}
                </div>
                <div className="text-xs text-[var(--ink-soft)] mt-1.5">
                  {c.provider} · {c.duration}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message={t("pages.noRecommendedCourses")} />
        )}
      </div>
    </>
  );
}

/* ============================ Profile ============================ */

export function ProfilePage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;
  const e = data.employee;

  return (
    <>
      <PageHeader title={t("pages.profileTitle")} subtitle={t("pages.profileSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] p-5 max-w-3xl">
        <div className="flex items-center gap-4 mb-5 pb-5 border-b border-[var(--line)]">
          <div className="w-14 h-14 rounded-full bg-[var(--teal-soft)] text-[var(--teal)] grid place-items-center text-xl font-bold">
            {e.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-lg">{e.name}</div>
            <div className="text-sm text-[var(--ink-soft)]">{e.designation}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-[var(--ink-soft)]">
              {t("ui.profileCompletion")}
            </div>
            <div className="font-semibold text-[var(--good)]">92%</div>
          </div>
        </div>
        <KeyValue
          rows={[
            { label: t("ui.employeeId"), value: e.id },
            { label: t("ui.name"), value: e.name },
            { label: t("ui.department"), value: e.department },
            { label: t("ui.role"), value: e.role },
            { label: t("ui.designation"), value: e.designation },
            { label: t("ui.group"), value: e.group },
            { label: t("ui.location"), value: e.location },
            { label: t("ui.yearsOfService"), value: e.yearsOfService },
          ]}
        />
      </div>
    </>
  );
}

/* ============================ Role & Activities ============================ */

export function RolePage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;
  const e = data.employee;

  return (
    <>
      <PageHeader title={t("pages.roleTitle")} subtitle={t("pages.roleSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <div className="text-xs uppercase text-[var(--ink-soft)]">{t("ui.department")}</div>
            <div className="font-semibold">{e.department}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[var(--ink-soft)]">{t("ui.designation")}</div>
            <div className="font-semibold">{e.designation}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-[var(--ink-soft)]">{t("ui.role")}</div>
            <div className="font-semibold">{e.role}</div>
          </div>
        </div>
      </div>

      <SectionTitle title={t("ui.rolesActionsRequiredCompetencies")} />
      <div className="space-y-2.5">
        {data.activities.map((a, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[var(--line)] p-4 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="font-semibold text-[var(--ink-soft)] shrink-0">
                {i + 1}.
              </span>
              <div className="font-semibold text-sm">{a.name}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {a.competencies.map((c) => (
                <span
                  key={c}
                  className="saksham-pill bg-[var(--teal-soft)] text-[var(--teal)]"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================ Competency Profile ============================ */

export function CompetencyPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  return (
    <>
      <PageHeader title={t("pages.competencyTitle")} subtitle={t("pages.competencySubtitle")} />
      {Object.entries(data.competencyCategories).map(([cat, names]) => (
        <div key={cat} className="mb-6">
          <SectionTitle title={cat} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {names.map((n) => {
              const c = data.competencies.find((x) => x.name === n);
              if (!c) return null;
              const gap = c.required - c.current;
              const p = priorityForGap(gap);
              return (
                <div
                  key={n}
                  className="bg-white rounded-xl border border-[var(--line)] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm">{n}</div>
                    {gap <= 0 ? (
                      <Pill fg="var(--good)" bg="var(--good-soft)">
                        {t("ui.onTarget")}
                      </Pill>
                    ) : (
                      <PriorityPill priority={p} />
                    )}
                  </div>
                  <div className="mt-3">
                    <LevelBar
                      current={c.current}
                      required={c.required}
                      levelNames={data.levelNames}
                    />
                  </div>
                  <div className="text-xs text-[var(--ink-soft)] mt-2">
                    {t("ui.evidence")}: {c.evidence}
                  </div>
                  <div className="text-xs text-[var(--ink-soft)]">
                    {t("ui.lastAssessed")}: {c.lastAssessed}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/* ============================ Skill Gap Analysis ============================ */

export function GapsPage() {
  const { data } = useAuth();
  const t = useT();
  const [filter, setFilter] = useState<string>("All");
  if (!data) return null;

  const gaps = data.competencies
    .map((c) => ({
      ...c,
      gap: c.required - c.current,
      priority: priorityForGap(c.required - c.current),
    }))
    .filter((c) => c.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  const list = filter === "All" ? gaps : gaps.filter((g) => g.priority === filter);
  const activityFor = (n: string) =>
    data.activities.find((a) => a.competencies.includes(n))?.name ||
    t("pages.generalRoleRequirement");

  return (
    <>
      <PageHeader title={t("pages.gapsTitle")} subtitle={t("pages.gapsSubtitle")} />

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {["All", "Critical", "High", "Medium", "Low"].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setFilter(p)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition",
              filter === p
                ? "bg-[var(--teal)] text-white"
                : "bg-white text-[var(--ink-soft)] border border-[var(--line)] hover:border-[var(--teal)]",
            )}
          >
            {p === "All" ? t("common.priorityAll") : t(`common.priority${p}`)}
          </button>
        ))}
      </div>

      {list.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map((g) => (
            <div
              key={g.name}
              className="bg-white rounded-xl border-l-4 border border-[var(--line)] p-4"
              style={{ borderLeftColor: priorityFg(g.priority) }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-sm">{g.name}</div>
                <PriorityPill priority={g.priority} />
              </div>
              <div className="mt-2">
                <LevelBar
                  current={g.current}
                  required={g.required}
                  levelNames={data.levelNames}
                />
              </div>
              <div className="text-xs text-[var(--ink-soft)] mt-2">
                {t("common.gap")}: {g.gap} {g.gap > 1 ? t("common.levels") : t("common.level")}
              </div>
              <div className="text-xs text-[var(--ink-soft)]">
                {t("pages.relatedActivity")}: {activityFor(g.name)}
              </div>
              <div className="text-xs text-[var(--ink-soft)] mt-0.5">
                {data.impactText[g.name] || t("pages.affectsPerformance")}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={t("pages.noGapsFound")} />
      )}
    </>
  );
}

/* ============================ Why (skill info) ============================ */

export function WhyPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const gapName =
    (typeof window !== "undefined" &&
      (window as unknown as { __sakshamGap?: string }).__sakshamGap) ||
    "SQL";
  const c =
    data.competencies.find((x) => x.name === gapName) ||
    data.competencies.find((x) => x.required > x.current);
  if (!c) return <EmptyState message={t("pages.noGapsFound")} />;

  const activity = data.activities.find((a) => a.competencies.includes(c.name));
  const gap = c.required - c.current;
  const priority = priorityForGap(gap);
  const steps = [
    { label: t("pages.whyYourRole"), value: data.employee.role },
    {
      label: t("pages.whyYourActivity"),
      value: activity?.name || t("pages.generalRoleRequirement"),
    },
    { label: t("pages.whyRequiredCompetency"), value: c.name },
    {
      label: t("pages.whyRequiredLevel"),
      value: `${data.levelNames[c.required]} (${c.required}/5)`,
    },
    {
      label: t("pages.whyCurrentLevel"),
      value: `${data.levelNames[c.current]} (${c.current}/5)`,
    },
    {
      label: t("pages.whyGap"),
      value: `${gap} ${gap > 1 ? t("common.levels") : t("common.level")}`,
    },
    {
      label: t("pages.whyImpact"),
      value: data.impactText[c.name] || t("pages.affectsPerformance"),
    },
  ];

  return (
    <>
      <PageHeader
        title={t("pages.whyTitle")}
        subtitle={`${t("ui.informationForSkill")}: ${c.name}`}
      />
      <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4 max-w-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs uppercase text-[var(--ink-soft)]">
            {t("ui.recommendation")}
          </div>
          <PriorityPill priority={priority} />
        </div>
        <h2 className="text-lg font-semibold mt-1">
          {t("ui.improveYourCompetency", { skill: c.name })}
        </h2>
      </div>

      <div className="max-w-2xl">
        {steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-7 h-7 rounded-full grid place-items-center text-xs font-bold",
                  i === 0
                    ? "bg-[var(--teal)] text-white"
                    : "bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--line)]",
                )}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 ? (
                <div className="w-px flex-1 bg-[var(--line)] my-1" />
              ) : null}
            </div>
            <div className="bg-white rounded-lg border border-[var(--line)] p-3 mb-3 flex-1">
              <div className="text-xs uppercase text-[var(--ink-soft)]">
                {s.label}
              </div>
              <div className="font-medium text-sm mt-0.5">{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-4">
        <a
          href="#learning"
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("saksham:nav", { detail: "learning" }),
            );
          }}
          className="saksham-btn-primary"
        >
          {t("ui.viewPersonalizedLearningPath")}
        </a>
        <a
          href="#assess"
          onClick={(e) => {
            e.preventDefault();
            window.dispatchEvent(
              new CustomEvent("saksham:nav", { detail: "assess" }),
            );
          }}
          className="saksham-btn-secondary"
        >
          {t("ui.seeCourseRecommendations")}
        </a>
      </div>
    </>
  );
}

/* ============================ Learning Path ============================ */

export function LearningPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const statusColor: Record<string, string> = {
    Completed: "var(--good)",
    "In Progress": "var(--teal)",
    Recommended: "var(--high)",
    Upcoming: "var(--ink-soft)",
  };

  return (
    <>
      <PageHeader title={t("pages.learningTitle")} subtitle={t("pages.learningSubtitle")} />
      <div>
        {data.learningPathSql.map((p, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full grid place-items-center text-xs font-bold",
                  p.status === "Completed"
                    ? "bg-[var(--good)] text-white"
                    : "bg-[var(--paper)] text-[var(--ink-soft)] border border-[var(--line)]",
                )}
              >
                {p.status === "Completed" ? "✓" : p.phase}
              </div>
              {i < data.learningPathSql.length - 1 ? (
                <div className="w-px flex-1 bg-[var(--line)] my-1" />
              ) : null}
            </div>
            <div className="bg-white rounded-lg border border-[var(--line)] p-4 mb-3 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs uppercase text-[var(--ink-soft)]">
                    {t("ui.phase")} {p.phase}
                  </div>
                  <div className="font-semibold text-sm mt-0.5">{p.title}</div>
                </div>
                <Pill fg={statusColor[p.status]} bg="var(--paper)">
                  {p.status}
                </Pill>
              </div>
              <div className="text-xs text-[var(--ink-soft)] mt-2 flex flex-wrap gap-4">
                <span>
                  {t("ui.source")}: {p.source}
                </span>
                <span>
                  {t("ui.duration")}: {p.duration}
                </span>
                <span>
                  {t("ui.difficulty")}: {p.difficulty}
                </span>
              </div>
              <div className="text-sm mt-2">
                {t("ui.expectedImprovement")}: <strong>{p.expected}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ============================ iGOT / Training & Assessments ============================ */

export function AssessPage() {
  const { data } = useAuth();
  const t = useT();
  const [tab, setTab] = useState<"igot" | "assess" | "exam">("igot");
  if (!data) return null;

  return (
    <>
      <PageHeader title={t("pages.assessTitle")} subtitle={t("pages.assessSubtitle")} />

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {(["igot", "assess", "exam"] as const).map((k) => (
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
            {k === "igot"
              ? t("common.tabIgotTraining")
              : k === "assess"
                ? t("common.tabAssessments")
                : t("common.tabExams")}
          </button>
        ))}
      </div>

      {tab === "igot" ? <IgotTab /> : tab === "assess" ? <AssessTab /> : <ExamTab />}
    </>
  );
}

function IgotTab() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const gapNames = new Set(
    data.competencies.filter((c) => c.required > c.current).map((c) => c.name),
  );
  const aiDaksh = IGOT_COURSES.filter((c) => c.track === "AI Daksh");
  const marketplace = IGOT_COURSES.filter((c) => c.track === "Marketplace");

  return (
    <>
      {/* Sadhana Saptah banner */}
      <div className="bg-gradient-to-r from-[var(--teal-soft)] to-[var(--good-soft)] rounded-xl border border-[var(--teal)]/20 p-4 mb-5">
        <div className="flex items-start gap-3">
          <Trophy className="text-[var(--teal)] shrink-0" size={22} />
          <div>
            <div className="font-semibold text-sm">{t("ui.sadhanaSaptah")}</div>
            <div className="text-xs text-[var(--ink-soft)] mt-1 leading-relaxed">
              {t("ui.sadhanaSaptahDesc")}
            </div>
            <div className="text-xs mt-2 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[var(--good)]" />
                {t("ui.aiDakshBadge")}: {t("ui.aiDakshBadgeDesc")}
              </span>
            </div>
            <div className="text-xs mt-1 flex gap-3">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-[var(--good)]" />
                {t("ui.karmayogiUtkarshBadge")}: {t("ui.karmayogiUtkarshBadgeDesc")}
              </span>
            </div>
          </div>
        </div>
      </div>

      <IgotCourseSection title={t("ui.aiDakshProgram")} courses={aiDaksh} t={t} gapNames={gapNames} />
      <IgotCourseSection title={t("ui.igotMarketplace")} courses={marketplace} t={t} gapNames={gapNames} />
    </>
  );
}

function IgotCourseSection({
  title,
  courses,
  t,
  gapNames,
}: {
  title: string;
  courses: typeof IGOT_COURSES;
  t: (path: string) => string;
  gapNames: Set<string>;
}) {
  return (
    <div className="mb-6">
      <SectionTitle title={title} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {courses.map((c) => (
          <div
            key={c.id}
            className="bg-white rounded-xl border border-[var(--line)] p-4 hover:border-[var(--teal)] transition flex flex-col"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm flex-1 line-clamp-2">
                {c.title}
              </div>
              {gapNames.has(c.competency) ? (
                <Pill fg="var(--teal)" bg="var(--teal-soft)">
                  {t("ui.closesGap")}
                </Pill>
              ) : null}
              {c.language === "hi" ? (
                <Pill fg="var(--high)" bg="var(--high-soft)">
                  हिन्दी
                </Pill>
              ) : null}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">
              {c.provider}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-1 flex items-center gap-1.5">
              <Clock size={12} />
              {c.duration}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">
              {t("ui.competency")}: {c.competency}
            </div>
            <a
              href="https://igotkarmayogi.gov.in"
              target="_blank"
              rel="noreferrer"
              className="saksham-btn-secondary mt-3 text-xs h-8"
            >
              {t("ui.viewCourse")} →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessTab() {
  const { data } = useAuth();
  const t = useT();
  const proctor = useProctor();
  const quiz = useQuiz();
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.assessments.map((a) => {
        const c = data.competencies.find((x) => x.name === a.competency);
        const done = data.assessmentsDone.includes(a.id);
        return (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-[var(--line)] p-4 flex flex-col"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm">{a.title}</div>
              {done ? (
                <Pill fg="var(--good)" bg="var(--good-soft)">
                  {t("ui.completed")}
                </Pill>
              ) : null}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">{a.competency}</div>
            <div className="text-xs text-[var(--ink-soft)] mt-2 flex gap-3">
              <span className="inline-flex items-center gap-1">
                <ListChecks size={12} /> {a.questions} {t("ui.questions")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {a.minutes} {t("ui.min")}
              </span>
            </div>
            {c ? (
              <div className="text-xs text-[var(--ink-soft)] mt-2">
                {t("common.current")}: {data.levelNames[c.current]} →{" "}
                {t("common.target")}: {data.levelNames[c.required]}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => quiz.begin(a.id, "assessment")}
              className={cn(
                "mt-3 h-9 text-sm",
                done ? "saksham-btn-secondary" : "saksham-btn-primary",
              )}
            >
              {done ? t("common.retakeAssessment") : t("common.startAssessment")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ExamTab() {
  const { data } = useAuth();
  const t = useT();
  const proctor = useProctor();
  const quiz = useQuiz();
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {data.exams.map((a) => {
        const c = data.competencies.find((x) => x.name === a.competency);
        const done = data.examsDone.includes(a.id);
        return (
          <div
            key={a.id}
            className="bg-white rounded-xl border border-[var(--line)] p-4 flex flex-col"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm">{a.title}</div>
              {done ? (
                <Pill fg="var(--good)" bg="var(--good-soft)">
                  {t("ui.completed")}
                </Pill>
              ) : null}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">{a.competency}</div>
            <div className="text-xs text-[var(--ink-soft)] mt-2 flex gap-3">
              <span className="inline-flex items-center gap-1">
                <ListChecks size={12} /> {a.questions} {t("ui.questions")}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {a.minutes} {t("ui.min")}
              </span>
            </div>
            {c ? (
              <div className="text-xs text-[var(--ink-soft)] mt-2">
                {t("common.current")}: {data.levelNames[c.current]} →{" "}
                {t("common.target")}: {data.levelNames[c.required]}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => quiz.begin(a.id, "exam")}
              className={cn(
                "mt-3 h-9 text-sm",
                done ? "saksham-btn-secondary" : "saksham-btn-primary",
              )}
            >
              {done ? t("common.retakeAssessment") : t("common.startAssessment")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ============================ Progress & Growth ============================ */

export function ProgressPage() {
  const { data } = useAuth();
  const t = useT();
  const quiz = useQuiz();
  if (!data) return null;

  // Use this session's quiz history (in-memory) merged with the seeded
  // historical data so the dashboard reflects both past and current attempts.
  const allHistory = [...data.assessmentHistory, ...quiz.assessmentHistory];
  const improved = allHistory.filter((h) => h.newLevel > h.prevLevel).length;
  const hours = 24 + improved * 6;

  return (
    <>
      <PageHeader title={t("pages.progressTitle")} subtitle={t("pages.progressSubtitle")} />

      {/* Condensed KPI row — 3 tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[
          {
            label: t("common.assessmentsCompletedLabel"),
            value: allHistory.length,
            sub: "",
          },
          {
            label: t("common.competenciesImproved"),
            value: improved,
            sub: t("ui.viaCompletedAssessments"),
          },
          {
            label: t("ui.learningHours"),
            value: hours,
            sub: "",
          },
        ].map((k, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[var(--line)] p-4"
          >
            <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide">
              {k.label}
            </div>
            <div className="text-3xl font-semibold text-[var(--navy)] mt-1">
              {k.value}
            </div>
            {k.sub ? (
              <div className="text-xs text-[var(--ink-soft)] mt-1">{k.sub}</div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4">
        <SectionTitle title={t("ui.competencyGrowthOverTime")} />
        <LineChart
          values={[2.3, 2.4, 2.5, 2.6, 2.6 + improved * 0.15, 2.7 + improved * 0.2]}
          labels={[t("ui.jan"), t("ui.feb"), t("ui.mar"), t("ui.apr"), t("ui.may"), t("ui.jun")]}
        />
      </div>

      {allHistory.length ? (
        <div className="bg-white rounded-xl border border-[var(--line)] p-4">
          <SectionTitle title={t("ui.gapReductionByAssessment")} />
          <div className="space-y-2">
            {allHistory.map((h, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2 border-b last:border-b-0 border-[var(--line)]"
              >
                <span className="font-semibold text-sm min-w-[160px]">
                  {h.assessment.competency}
                </span>
                <span className="text-sm text-[var(--ink-soft)]">
                  {t("pages.before")}: {data.levelNames[h.prevLevel]}
                </span>
                <ArrowRight size={14} className="text-[var(--ink-soft)]" />
                <span className="text-sm font-semibold text-[var(--good)]">
                  {t("pages.after")}: {data.levelNames[h.newLevel]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

/* ============================ Helpers ============================ */

function priorityForGap(gap: number): "Critical" | "High" | "Medium" | "Low" {
  if (gap >= 2) return "Critical";
  if (gap === 1) return "High";
  if (gap === 0) return "Medium";
  return "Low";
}

function priorityFg(p: string): string {
  const m: Record<string, string> = {
    Critical: "#A63D2F",
    High: "#C97A2C",
    Medium: "#9C8B3C",
    Low: "#2F6F4F",
  };
  return m[p] ?? m.Medium;
}
