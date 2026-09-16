"use client";

/**
 * Trainer / ATI-facing pages.
 * Ported from public/js/trainer-pages.js with the same govt-modern styling
 * and the "remove unnecessary boxes" mandate applied.
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import {
  PageHeader,
  SectionTitle,
  Pill,
  PriorityPill,
} from "@/components/saksham/primitives";
import { BarChart } from "@/components/saksham/charts";
import { Clock, Users, Sparkles, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/saksham/activity-feed";
import { AssignDialog } from "@/components/saksham/assign-dialog";
import { useToast } from "@/hooks/use-toast";

export function TrainerDashboard() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const total = data.trainingPrograms.reduce((s, p) => s + p.participants, 0);
  const active = data.trainingPrograms.filter((p) => p.status === "Active").length;

  const kpis = [
    { label: t("common.activePrograms"), value: active, accent: "var(--navy)" },
    { label: t("common.participants"), value: total, accent: "var(--teal)" },
    { label: t("common.competencyGapsAddressed"), value: 4, accent: "var(--high)" },
    { label: t("common.avgAssessmentScore"), value: "76%", accent: "var(--good)" },
  ];

  return (
    <>
      <PageHeader title={t("pages.tDashboardTitle")} subtitle="Suman Bansal · ATI Punjab" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-[var(--line)] p-4">
            <div className="text-xs uppercase text-[var(--ink-soft)] tracking-wide">
              {k.label}
            </div>
            <div
              className="text-2xl font-semibold mt-1"
              style={{ color: k.accent }}
            >
              {k.value}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[var(--line)] p-4">
          <SectionTitle title={t("common.trainingParticipation")} />
          <BarChart
            data={data.trainingPrograms.map((p) => ({
              label: p.title,
              value: p.participants,
            }))}
          />
        </div>
        <ActivityFeed />
      </div>
    </>
  );
}

export function TrainingContent() {
  const { data } = useAuth();
  const t = useT();
  const [assignOpen, setAssignOpen] = useState(false);
  if (!data) return null;

  return (
    <>
      <PageHeader
        title={t("pages.tContentTitle")}
        subtitle={t("pages.tContentSubtitle")}
        right={
          <button
            type="button"
            onClick={() => setAssignOpen(true)}
            className="saksham-btn-primary h-9 px-3 text-sm inline-flex items-center gap-1.5"
          >
            <UserPlus size={15} />
            {t("pages.assignToEmployee")}
          </button>
        }
      />
      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.trainingPrograms.map((p) => (
          <div
            key={p.id}
            className="bg-white rounded-xl border border-[var(--line)] p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-semibold text-sm">{p.title}</div>
              <Pill
                fg={p.status === "Active" ? "var(--good)" : "var(--high)"}
                bg={p.status === "Active" ? "var(--good-soft)" : "var(--high-soft)"}
              >
                {p.status}
              </Pill>
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">
              {p.competency} · {t("common.target")}: {p.targetLevel}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-1">
              {t("common.for")}: {p.targetRole}
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2 flex flex-wrap gap-3">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {p.duration}
              </span>
              <span>{p.mode}</span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                {p.participants} {t("common.participants")}
              </span>
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2">
              {t("common.trainerLabel")}: {p.trainer}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function AssessmentGenerator() {
  const { data } = useAuth();
  const t = useT();
  const { toast } = useToast();
  const [title, setTitle] = useState("Advanced SQL for Government Data");
  const [competency, setCompetency] = useState("SQL");
  const [numQ, setNumQ] = useState(4);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generated, setGenerated] = useState<
    Array<{ q: string; options: string[]; answer: number; explanation?: string }> | null
  >(null);

  if (!data) return null;

  // Workstream C.4 — generate via the AI mini-service (real LLM when
  // LLM_ENABLED=true on the service, deterministic mock otherwise).
  const generate = async () => {
    setGenerating(true);
    setGenerated(null);
    try {
      const { io } = await import("socket.io-client");
      const { aiSocketUrl } = await import("@/lib/socket-url");
      const s = io(aiSocketUrl(), {
        transports: ["websocket", "polling"],
        timeout: 5000,
      });
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("AI service timed out")),
          20000,
        );
        s.emit(
          "generate_assessment",
          { title, competency, count: numQ, difficulty: "Intermediate" },
          (
            res: { questions?: Array<{ q: string; options: string[]; answer: number; explanation?: string }>; source?: string; error?: string },
          ) => {
            clearTimeout(timer);
            if (res?.error || !res?.questions?.length) {
              reject(new Error(res?.error ?? "Generation failed"));
              return;
            }
            setGenerated(res.questions);
            toast({
              title: t("ui.generatedQuestions"),
              description: `${res.questions.length} · ${res.source === "llm" ? "LLM" : "offline mock"}`,
            });
            resolve();
          },
        );
        s.on("connect_error", () => {
          clearTimeout(timer);
          reject(new Error("AI service unreachable"));
        });
      });
      s.disconnect();
    } catch (err) {
      toast({
        title: "Generation failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // Publish: persist the generated bank through the Store so employees can
  // attempt it via the normal start/submit flow.
  const publish = async () => {
    if (!generated?.length) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          competency,
          kind: "CHECKPOINT",
          questions: generated,
        }),
      });
      const payload = (await res.json()) as {
        assessment?: { externalId: string };
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error ?? "Publish failed");
      toast({
        title: t("ui.publishAssessment"),
        description: payload.assessment?.externalId,
      });
      setGenerated(null);
    } catch (err) {
      toast({
        title: "Publish failed",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      <PageHeader title={t("pages.tGeneratorTitle")} subtitle={t("pages.tGeneratorSubtitle")} />

      <div className="bg-white rounded-xl border border-[var(--line)] p-4 max-w-xl mb-4">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium block mb-1">
              {t("ui.trainingTitle")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="saksham-input"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              {t("ui.competency")}
            </label>
            <select
              value={competency}
              onChange={(e) => setCompetency(e.target.value)}
              className="saksham-input"
            >
              {["SQL", "Data Quality Frameworks", "Survey Design", "Communication"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              {t("ui.numberOfQuestions")}
            </label>
            <input
              type="number"
              min={2}
              max={6}
              value={numQ}
              onChange={(e) => setNumQ(Number(e.target.value))}
              className="saksham-input"
            />
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="saksham-btn-primary w-full"
          >
            <Sparkles size={16} />
            {generating ? t("ui.generating") : t("ui.generateAssessment")}
          </button>
        </div>
      </div>

      {generated ? (
        <div>
          <SectionTitle title={`${t("ui.generatedQuestions")} — ${competency}`} />
          <div className="space-y-2 max-w-2xl">
            {generated.map((q, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-[var(--line)] p-3"
              >
                <div className="font-semibold text-sm mb-2">
                  {i + 1}. {q.q}
                </div>
                {q.options.map((o, oi) => (
                  <div
                    key={oi}
                    className={cn(
                      "text-sm py-0.5",
                      oi === q.answer
                        ? "text-[var(--good)] font-medium"
                        : "text-[var(--ink-soft)]",
                    )}
                  >
                    {oi === q.answer ? "◉" : "○"} {o}
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <button className="saksham-btn-secondary text-xs h-7 px-2.5">
                    {t("common.edit")}
                  </button>
                  <button
                    onClick={generate}
                    className="saksham-btn-secondary text-xs h-7 px-2.5"
                  >
                    {t("ui.regenerate")}
                  </button>
                </div>
              </div>
            ))}
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                className="saksham-btn-secondary text-sm"
                onClick={() => setGenerated(null)}
              >
                {t("ui.saveAsDraft")}
              </button>
              <button
                type="button"
                className="saksham-btn-primary text-sm"
                disabled={publishing}
                onClick={() => void publish()}
              >
                {publishing ? "…" : t("ui.publishAssessment")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function AssessmentManagement() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const rows = [
    ["SQL Skill Assessment", "Published", "74%", 34],
    ["Data Quality & Validation Frameworks — checkpoint", "Published", "81%", 21],
    ["Advanced SQL for Government Data — checkpoint", "Draft", "—", 0],
    ["Digital Governance Assessment", "Completed", "88%", 112],
  ] as const;

  return (
    <>
      <PageHeader title={t("pages.tManageTitle")} subtitle={t("pages.tManageSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper)]">
              <tr>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.assessment")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.published")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.avgScore")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("common.participants")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium">{r[0]}</td>
                  <td className="px-4 py-3">
                    <Pill
                      fg={
                        r[1] === "Published"
                          ? "var(--teal)"
                          : r[1] === "Draft"
                            ? "var(--high)"
                            : "var(--good)"
                      }
                      bg={
                        r[1] === "Published"
                          ? "var(--teal-soft)"
                          : r[1] === "Draft"
                            ? "var(--high-soft)"
                            : "var(--good-soft)"
                      }
                    >
                      {r[1]}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">{r[2]}</td>
                  <td className="px-4 py-3">{r[3]}</td>
                  <td className="px-4 py-3">
                    <span className="saksham-link text-xs">{t("common.view")}</span>
                    <span className="text-[var(--ink-soft)] mx-1">·</span>
                    <span className="saksham-link text-xs">{t("common.edit")}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function TrainingPlanning() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  return (
    <>
      <PageHeader title={t("pages.tPlanningTitle")} subtitle={t("pages.tPlanningSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] p-4 mb-4">
        <div className="text-xs uppercase text-[var(--ink-soft)]">
          {t("ui.department")}
        </div>
        <div className="font-semibold mt-0.5 mb-3">
          {t("ui.highDemandCompetencies")}
        </div>
        <div className="flex flex-wrap gap-2">
          {["Data Quality", "SQL", "AI/ML", "Survey Design"].map((c, i) => (
            <Pill key={c} fg="var(--navy)" bg="var(--paper)">
              {i + 1}. {c}
            </Pill>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[var(--line)] p-4">
        <SectionTitle
          title={t("ui.competencyGapTrainingDemandTrainingPlan")}
        />
        <div className="space-y-2">
          {data.orgGaps.slice(0, 4).map((g) => (
            <div
              key={g.competency}
              className="flex flex-wrap items-center gap-3 py-2 border-b last:border-b-0 border-[var(--line)]"
            >
              <span className="font-semibold text-sm min-w-[170px]">
                {g.competency}
              </span>
              <span className="text-sm text-[var(--ink-soft)]">
                {g.affected} {t("ui.employeesAffected")}
              </span>
              <span className="text-[var(--ink-soft)]">→</span>
              <PriorityPill
                priority={g.priority === "High" ? "High" : "Medium"}
              />
              <span className="text-[var(--ink-soft)]">→</span>
              <span className="text-sm font-medium text-[var(--teal)]">
                {t("ui.plannedQ3Cohort")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
