"use client";

/**
 * Shared Saksham UI primitives — small presentational helpers used by every
 * page (employee/trainer/admin). Kept in one file so the design vocabulary
 * stays consistent.
 */

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/lang-context";

/** Page header: title + optional subtitle + optional right-side actions. */
export function PageHeader({
  title,
  subtitle,
  right,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="saksham-page-title truncate">{title}</h1>
        {subtitle ? (
          <p className="saksham-page-subtitle">{subtitle}</p>
        ) : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </header>
  );
}

/** Section title bar with optional right-side link/button. */
export function SectionTitle({
  title,
  right,
  className,
}: {
  title: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 mb-3",
        className,
      )}
    >
      <h2 className="saksham-section-title">{title}</h2>
      {right}
    </div>
  );
}

/** Pill badge with semantic colour. */
export function Pill({
  children,
  fg,
  bg,
  className,
}: {
  children: ReactNode;
  fg?: string;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("saksham-pill", className)}
      style={{
        color: fg ?? "var(--ink)",
        background: bg ?? "var(--paper)",
      }}
    >
      {children}
    </span>
  );
}

/** Priority pill — Critical/High/Medium/Low.
 *  Color-blind safe: each priority carries a distinct SHAPE cue in addition
 *  to colour (▲ critical, ◆ high, ■ medium, ● low) so the value survives
 *  deuteranopia/protanopia. */
export function PriorityPill({ priority }: { priority: string }) {
  const t = useT();
  const styles: Record<string, { fg: string; bg: string; shape: string }> = {
    Critical: { fg: "#A63D2F", bg: "#F6E7E4", shape: "▲" },
    High: { fg: "#C97A2C", bg: "#FAEEE0", shape: "◆" },
    Medium: { fg: "#9C8B3C", bg: "#F5F1DF", shape: "■" },
    Low: { fg: "#2F6F4F", bg: "#E6F0EA", shape: "●" },
  };
  const s = styles[priority] ?? styles.Medium;
  const keyMap: Record<string, string> = {
    Critical: "common.priorityCritical",
    High: "common.priorityHigh",
    Medium: "common.priorityMedium",
    Low: "common.priorityLow",
  };
  return (
    <Pill fg={s.fg} bg={s.bg}>
      <span aria-hidden="true" className="mr-1">{s.shape}</span>
      {t(keyMap[priority] ?? "common.priorityMedium")}
    </Pill>
  );
}

/** Status pill — Strong / Adequate / Gap / Critical Gap. */
export function StatusPill({ status }: { status: string }) {
  const t = useT();
  const styles: Record<string, { fg: string; bg: string }> = {
    Strong: { fg: "#2F6F4F", bg: "#E6F0EA" },
    Adequate: { fg: "#0E7C7B", bg: "#C9E4E3" },
    Gap: { fg: "#C97A2C", bg: "#FAEEE0" },
    "Critical Gap": { fg: "#A63D2F", bg: "#F6E7E4" },
  };
  const s = styles[status] ?? styles.Gap;
  const keyMap: Record<string, string> = {
    Strong: "common.statusStrong",
    Adequate: "common.statusAdequate",
    Gap: "common.statusGap",
    "Critical Gap": "common.statusCriticalGap",
  };
  return (
    <Pill fg={s.fg} bg={s.bg}>
      {t(keyMap[status] ?? "common.statusGap")}
    </Pill>
  );
}

/**
 * Level bar — current vs required, 0-5 scale. The "required" marker is a
 * dashed vertical line at the required position; the filled portion shows
 * the current level.
 */
export function LevelBar({
  current,
  required,
  compact = false,
  levelNames,
}: {
  current: number;
  required: number;
  compact?: boolean;
  levelNames?: string[];
}) {
  const t = useT();
  const pct = (v: number) => `${Math.min(100, (v / 5) * 100)}%`;
  return (
    <div>
      <div className="relative h-2 rounded-full bg-[var(--paper)] overflow-visible">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[var(--teal)]"
          style={{ width: pct(current) }}
        />
        <div
          className="absolute inset-y-[-3px] w-[2px] bg-[var(--navy)]"
          style={{ left: `calc(${pct(required)} - 1px)` }}
        />
      </div>
      {!compact ? (
        <div className="flex justify-between text-xs text-[var(--ink-soft)] mt-1.5">
          <span>
            {t("common.current")}: {levelNames?.[current] ?? `${current}/5`}
          </span>
          <span>
            {t("common.required")}: {levelNames?.[required] ?? `${required}/5`}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Empty state — single line message with a subtle icon. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-12 text-[var(--ink-soft)]">
      <div className="text-3xl opacity-40 mb-2">—</div>
      <div>{message}</div>
    </div>
  );
}

/** Small key-value list used in profile / role / why pages. */
export function KeyValue({
  rows,
}: {
  rows: Array<{ label: string; value: ReactNode }>;
}) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
      {rows.map((r, i) => (
        <div key={i}>
          <dt className="text-xs uppercase tracking-wide text-[var(--ink-soft)]">
            {r.label}
          </dt>
          <dd className="font-medium mt-0.5">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
