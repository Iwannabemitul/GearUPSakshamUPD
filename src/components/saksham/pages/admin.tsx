"use client";

/**
 * Admin / organization-facing pages.
 * Ported from public/js/admin-pages.js with the govt-modern styling.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import {
  PageHeader,
  SectionTitle,
  PriorityPill,
  StatusPill,
  LevelBar,
} from "@/components/saksham/primitives";
import { BarChart } from "@/components/saksham/charts";
import { ActivityFeed } from "@/components/saksham/activity-feed";
import { useRealtime } from "@/lib/realtime-context";
import { cn } from "@/lib/utils";

export function AdminDashboard() {
  const { data } = useAuth();
  const t = useT();
  const [dept, setDept] = useState("All");
  if (!data) return null;

  // C.6 — department filter: KPIs and charts recompute in place when a
  // department is selected.
  const rows =
    dept === "All"
      ? data.workforce
      : data.workforce.filter((e) => e.dept === dept);
  const compKeys = ["SQL", "Data Quality", "Survey Design", "Data Visualization"];
  const avgOf = (list: typeof data.workforce) =>
    list.length === 0
      ? 0
      : list.reduce(
          (s, e) =>
            s +
            compKeys.reduce(
              (x, c) => x + (e as unknown as Record<string, number>)[c],
              0,
            ) /
              compKeys.length,
          0,
        ) / list.length;

  const orgScale = 240 / Math.max(1, data.workforce.length); // demo workforce is a sample
  const deptAvg = avgOf(rows);
  const deptGaps = rows.filter((e) =>
    compKeys.some(
      (c) =>
        (e as unknown as Record<string, number>)[c] <
        (data.requiredByRole[e.role] || 3),
    ),
  ).length;

  const depts = data.departments.map((d) => {
    const emps = data.workforce.filter((e) => e.dept === d);
    const avg = avgOf(emps);
    return { label: d.replace("Department of ", ""), value: Number(avg.toFixed(2)) };
  });

  const kpis = [
    {
      label: t("common.totalEmployees"),
      value: dept === "All" ? data.workforce.length + 240 : Math.round(rows.length * orgScale),
      accent: "var(--navy)",
    },
    { label: t("common.employeesAssessed"), value: "68%", accent: "var(--teal)" },
    {
      label: t("common.criticalSkillGaps"),
      value: dept === "All"
        ? data.orgGaps.filter((g) => g.priority === "High").length
        : deptGaps,
      accent: "var(--critical)",
    },
    {
      label: t("common.averageCompetency"),
      value: dept === "All" ? "2.8 / 5" : `${deptAvg.toFixed(1)} / 5`,
      accent: "var(--medium)",
    },
    { label: t("common.gapReductionYoy"), value: "+0.4", accent: "var(--good)" },
  ];

  return (
    <>
      <PageHeader title={t("pages.aDashboardTitle")} subtitle={t("pages.aDashboardSubtitle")} />

      {/* C.6 — department filter updates KPIs + charts in place */}
      <div className="mb-4">
        <label htmlFor="admin-dept-filter" className="sr-only">
          {t("common.department")}
        </label>
        <select
          id="admin-dept-filter"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="saksham-input max-w-xs"
        >
          <option value="All">{t("common.allDepartments")}</option>
          {data.departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {kpis.map((k, i) => (
          <div key={i} className="bg-white rounded-xl border border-[var(--line)] p-3">
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
          <SectionTitle title={t("common.departmentComparison")} />
          <BarChart data={depts} />
        </div>
        <div className="bg-white rounded-xl border border-[var(--line)] p-4">
          <SectionTitle title={t("common.criticalSkillGaps")} />
          <div className="space-y-1.5">
            {data.orgGaps.map((g) => (
              <div
                key={g.competency}
                className="flex items-center justify-between text-sm py-1.5 border-b last:border-b-0 border-[var(--line)]"
              >
                <span>{g.competency}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--ink-soft)]">
                    {g.affected} {t("common.employeesAffected")}
                  </span>
                  <PriorityPill priority={g.priority} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ActivityFeed />
      </div>
    </>
  );
}

export function WorkforcePage() {
  const { data } = useAuth();
  const t = useT();
  const { presence } = useRealtime();
  const [dept, setDept] = useState("All");
  const [nameToId, setNameToId] = useState<Map<string, string>>(new Map());

  // Live users from the workforce API give us stable ids for presence dots;
  // the static table rows are matched by name (demo data).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/trainer/workforce");
        if (res.ok) {
          const payload = (await res.json()) as {
            workforce: Array<{ id: string; name: string }>;
          };
          setNameToId(
            new Map(payload.workforce.map((u) => [u.name, u.id])),
          );
        }
      } catch {
        /* offline — dots simply stay off */
      }
    })();
  }, []);
  if (!data) return null;

  const rows =
    dept === "All"
      ? data.workforce
      : data.workforce.filter((e) => e.dept === dept);
  const competencies = ["SQL", "Data Quality", "Survey Design", "Data Visualization"];

  const PresenceDot = ({ name }: { name: string }) => {
    const id = nameToId.get(name);
    if (!id) return null;
    const online = presence.get(id);
    if (online === undefined) return null;
    return (
      <span
        className={cn(
          "inline-block w-2 h-2 rounded-full ml-1.5 align-middle",
          online ? "bg-[var(--good)]" : "bg-[var(--ink-soft)] opacity-40",
        )}
        title={online ? t("pages.online") : t("pages.offline")}
      />
    );
  };

  return (
    <>
      <PageHeader title={t("pages.aWorkforceTitle")} subtitle={t("pages.aWorkforceSubtitle")} />
      <div className="mb-4">
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="saksham-input max-w-xs"
        >
          <option value="All">All</option>
          {data.departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>
      <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper)]">
              <tr>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.employee")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.role")}
                </th>
                {competencies.map((c) => (
                  <th
                    key={c}
                    className="text-left font-medium text-[var(--ink-soft)] px-4 py-3"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium">
                    {e.name}
                    <PresenceDot name={e.name} />
                  </td>
                  <td className="px-4 py-3 text-[var(--ink-soft)]">{e.role}</td>
                  {competencies.map((c) => {
                    const val = (e as unknown as Record<string, number>)[c];
                    const req = data.requiredByRole[e.role] || 3;
                    const st = statusFor(val, req);
                    return (
                      <td key={c} className="px-4 py-3">
                        <span className="font-semibold mr-1">{val}/5</span>
                        <StatusPill status={st} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function OrgGapsPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  return (
    <>
      <PageHeader title={t("pages.aGapsTitle")} subtitle={t("pages.aGapsSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper)]">
              <tr>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.competency")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.employeesAffected")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.avgCurrent")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("ui.required")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("common.gap")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  Priority
                </th>
              </tr>
            </thead>
            <tbody>
              {data.orgGaps.map((g) => (
                <tr key={g.competency} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium">{g.competency}</td>
                  <td className="px-4 py-3">{g.affected}</td>
                  <td className="px-4 py-3">{g.avgCurrent.toFixed(1)}</td>
                  <td className="px-4 py-3">{g.required.toFixed(1)}</td>
                  <td className="px-4 py-3">
                    {(g.required - g.avgCurrent).toFixed(1)}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityPill priority={g.priority} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-[var(--line)] p-4">
        <SectionTitle title={t("ui.gapSizeByCompetency")} />
        <BarChart
          data={data.orgGaps.map((g) => ({
            label: g.competency,
            value: Number((g.required - g.avgCurrent).toFixed(1)),
          }))}
        />
      </div>
    </>
  );
}

export function EffectivenessPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  return (
    <>
      <PageHeader title={t("pages.aEffectivenessTitle")} subtitle={t("pages.aEffectivenessSubtitle")} />
      <div className="bg-white rounded-xl border border-[var(--line)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper)]">
              <tr>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("pages.program")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("pages.before")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("pages.after")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("pages.improvement")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("pages.completion")}
                </th>
                <th className="text-left font-medium text-[var(--ink-soft)] px-4 py-3">
                  {t("common.participants")}
                </th>
              </tr>
            </thead>
            <tbody>
              {data.trainingEffectiveness.map((r, i) => (
                <tr key={i} className="border-t border-[var(--line)]">
                  <td className="px-4 py-3 font-medium">{r.program}</td>
                  <td className="px-4 py-3">{r.before.toFixed(1)}</td>
                  <td className="px-4 py-3">{r.after.toFixed(1)}</td>
                  <td className="px-4 py-3 font-semibold text-[var(--good)]">
                    +{(r.after - r.before).toFixed(1)}
                  </td>
                  <td className="px-4 py-3">{r.completion}%</td>
                  <td className="px-4 py-3">{r.participants}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export function EmergingPage() {
  const { data } = useAuth();
  const t = useT();
  if (!data) return null;

  const skills: Array<[string, number, number, "High" | "Medium"]> = [
    ["Generative AI", 1.4, 4.5, "High"],
    ["Data Governance", 2, 4, "High"],
    ["Cybersecurity", 2.2, 4.2, "High"],
    ["Cloud", 1.8, 3.6, "Medium"],
    ["Digital Public Infrastructure", 1.6, 3.8, "Medium"],
  ];

  return (
    <>
      <PageHeader title={t("pages.aEmergingTitle")} subtitle={t("pages.aEmergingSubtitle")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {skills.map(([name, current, required, p]) => (
          <div key={name} className="bg-white rounded-xl border border-[var(--line)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-sm">{name}</div>
              <PriorityPill priority={p} />
            </div>
            <div className="text-xs text-[var(--ink-soft)] mt-2 mb-1">
              {t("ui.currentCapabilityFutureImportance")}
            </div>
            <LevelBar current={Math.round(current)} required={Math.round(required)} compact />
            <div className="text-xs text-[var(--ink-soft)] mt-2">
              {t("ui.recommended")}: AI Fundamentals for Public Servants (iGOT)
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function statusFor(current: number, required: number): string {
  if (current >= required) return "Strong";
  if (current === required - 1) return "Adequate";
  if (current === required - 2) return "Gap";
  return "Critical Gap";
}
