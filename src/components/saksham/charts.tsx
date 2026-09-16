"use client";

/**
 * Lightweight SVG charts for Saksham — no chart library, no deps.
 * Ported from the original vanilla prototype (charts-login.js) and wrapped
 * in React components. Each chart is responsive (viewBox + width:100%).
 */

import { type ReactNode } from "react";

/* ---------- Radar chart: current vs required competencies ---------- */

export function RadarChart({
  data,
}: {
  data: Array<{ label: string; current: number; required: number }>;
}) {
  const w = 620;
  const h = 280;
  const cx = 310;
  const cy = 138;
  const r = 94;

  const pts = (radius: number, values: number[]) =>
    values
      .map((v, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / values.length;
        const rr = (radius * v) / 5;
        return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
      })
      .join(" ");

  const current = data.map((d) => d.current);
  const required = data.map((d) => d.required);

  const axes = data
    .map((d, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / data.length;
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const lx = cx + Math.cos(a) * (r + 26);
      const ly = cy + Math.sin(a) * (r + 26);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#E5E2D8"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="#4B5563" font-family="ui-sans-serif,system-ui">${escapeXml(d.label.split(" ")[0])}</text>`;
    })
    .join("");

  return (
    <svg
      className="w-full h-auto"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Competency overview"
    >
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E5E2D8" />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="none" stroke="#E5E2D8" />
      <circle cx={cx} cy={cy} r={r * 0.3} fill="none" stroke="#E5E2D8" />
      <g dangerouslySetInnerHTML={{ __html: axes }} />
      <polygon
        points={pts(r, current)}
        fill="#0E7C7B"
        fillOpacity="0.22"
        stroke="#0E7C7B"
        strokeWidth="2"
      />
      <polygon
        points={pts(r, required)}
        fill="none"
        stroke="#16232F"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      <text x="16" y="22" fontSize="11" fill="#4B5563">
        Current
      </text>
      <line x1="68" y1="18" x2="98" y2="18" stroke="#0E7C7B" strokeWidth="3" />
      <text x="16" y="42" fontSize="11" fill="#4B5563">
        Required
      </text>
      <line
        x1="68"
        y1="38"
        x2="98"
        y2="38"
        stroke="#16232F"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
    </svg>
  );
}

/* ---------- Bar chart ---------- */

export function BarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-3 h-44 px-2 overflow-x-auto">
      {data.map((d, i) => (
        <div key={i} className="flex flex-col items-center min-w-[60px] flex-1">
          <div className="text-xs font-semibold mb-1">{d.value}</div>
          <div
            className="w-full rounded-t-md bg-[var(--teal)] transition-all"
            style={{
              height: `${Math.max(6, (d.value / max) * 120)}px`,
              minHeight: "6px",
            }}
          />
          <div className="text-[11px] text-[var(--ink-soft)] mt-1.5 text-center line-clamp-2">
            {d.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Line chart (growth trend) ---------- */

export function LineChart({
  values,
  labels = ["Q1", "Q2", "Q3", "Q4"],
}: {
  values: number[];
  labels?: string[];
}) {
  const w = 620;
  const h = 180;
  const p = 24;
  const min = 0;
  const max = 5;
  const sx = (i: number) => p + (i * (w - 2 * p)) / Math.max(1, values.length - 1);
  const sy = (v: number) => h - p - ((v - min) / (max - min)) * (h - 2 * p);
  const pts = values.map((v, i) => `${sx(i)},${sy(v)}`).join(" ");

  return (
    <svg
      className="w-full h-auto"
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label="Growth trend"
    >
      <line x1={p} y1={h - p} x2={w - p} y2={h - p} stroke="#E5E2D8" />
      <polyline
        points={pts}
        fill="none"
        stroke="#0E7C7B"
        strokeWidth="3"
      />
      {values.map((v, i) => (
        <g key={i}>
          <circle cx={sx(i)} cy={sy(v)} r="4" fill="#0E7C7B" />
          <text
            x={sx(i)}
            y={h - 8}
            textAnchor="middle"
            fontSize="11"
            fill="#4B5563"
          >
            {labels[i] ?? ""}
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ---------- Pie chart (question breakdown) ---------- */

export function PieChart({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const w = 320;
  const h = 220;
  const cx = 110;
  const cy = 110;
  const r = 90;
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  let angle = -Math.PI / 2;
  const arcs: Array<{ d: string; color: string; label: string; value: number; pct: number }> = [];
  for (const seg of segments) {
    if (seg.value <= 0) continue;
    const slice = (seg.value / total) * 2 * Math.PI;
    const start = angle;
    const end = angle + slice;
    angle = end;
    const x1 = cx + Math.cos(start) * r;
    const y1 = cy + Math.sin(start) * r;
    const x2 = cx + Math.cos(end) * r;
    const y2 = cy + Math.sin(end) * r;
    const largeArc = slice > Math.PI ? 1 : 0;
    const isFullCircle = seg.value === total;
    const d = isFullCircle
      ? `M ${cx - r},${cy} A ${r},${r} 0 1 1 ${cx + r},${cy} A ${r},${r} 0 1 1 ${cx - r},${cy} Z`
      : `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`;
    const pct = Math.round((seg.value / total) * 100);
    arcs.push({ d, color: seg.color, label: seg.label, value: seg.value, pct });
  }

  return (
    <div className="flex flex-wrap items-center gap-6">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: 220, height: 220, flexShrink: 0 }}
        role="img"
        aria-label="Question breakdown"
      >
        {arcs.map((a, i) => (
          <path
            key={i}
            d={a.d}
            fill={a.color}
            stroke="#fff"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex flex-col gap-2">
        {arcs.map((a, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ background: a.color }}
            />
            <span className="font-semibold text-sm">{a.label}</span>
            <span className="text-[var(--ink-soft)] text-sm">
              {a.value} ({a.pct}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
      default:
        return c;
    }
  });
}
