"use client";

/**
 * ActivityFeed — live feed of workforce events for Trainers (own department)
 * and Admins (whole organisation).
 *
 * Data comes from GET /api/trainer/activity on mount, then realtime events
 * prepend to it: assessment:submitted (with score + level change),
 * assignment:created / assignment:updated, competency:updated.
 */

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/lang-context";
import { useRealtimeEvent } from "@/lib/realtime-context";
import { SectionTitle, EmptyState } from "@/components/saksham/primitives";
import { Activity, Award, ClipboardCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";

type FeedItem = {
  kind: string;
  at: string;
  userName?: string;
  [key: string]: unknown;
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  "assessment:submitted": <ClipboardCheck size={15} />,
  "assessment:started": <Activity size={15} />,
  "assignment:created": <Send size={15} />,
  "assignment:completed": <ClipboardCheck size={15} />,
  "competency:updated": <Award size={15} />,
};

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function ActivityFeed() {
  const t = useT();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trainer/activity");
      if (res.ok) {
        const data = (await res.json()) as { items: FeedItem[] };
        setItems(data.items);
      }
    } catch {
      /* offline */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime prepend/replace.
  useRealtimeEvent("assessment:submitted", (payload) => {
    const p = payload as {
      attemptId?: string;
      userName?: string;
      assessmentTitle?: string;
      score?: number;
      prevLevel?: number;
      newLevel?: number;
    };
    if (!p?.attemptId) return;
    setItems((prev) => [
      {
        kind: "assessment:submitted",
        at: new Date().toISOString(),
        userName: p.userName,
        assessmentTitle: p.assessmentTitle,
        score: p.score,
        prevLevel: p.prevLevel,
        newLevel: p.newLevel,
      },
      ...prev.filter(
        (x) => x.kind !== "assessment:submitted" || x.attemptId !== p.attemptId,
      ),
    ]);
  });

  useRealtimeEvent("assignment:updated", (payload) => {
    const p = payload as {
      id?: string;
      assigneeName?: string;
      assessmentId?: string | null;
      courseId?: string | null;
      type?: string;
      status?: string;
    };
    if (!p?.id) return;
    setItems((prev) => {
      const existing = prev.find(
        (x) => x.kind === "assignment:created" && x.assignmentId === p.id,
      );
      const title = p.type === "COURSE" ? p.courseId : p.assessmentId;
      const item: FeedItem = {
        kind: p.status === "COMPLETED" ? "assignment:completed" : "assignment:created",
        at: new Date().toISOString(),
        userName: p.assigneeName,
        title,
        type: p.type,
      };
      return [item, ...prev.filter((x) => x !== existing)];
    });
  });

  useRealtimeEvent("competency:updated", (payload) => {
    const p = payload as {
      userName?: string;
      competency?: string;
      prevLevel?: number;
      newLevel?: number;
    };
    if (!p?.competency) return;
    setItems((prev) => [
      {
        kind: "competency:updated",
        at: new Date().toISOString(),
        userName: p.userName,
        competency: p.competency,
        prevLevel: p.prevLevel,
        newLevel: p.newLevel,
      },
      ...prev,
    ]);
  });

  return (
    <div className="bg-white rounded-xl border border-[var(--line)] p-4">
      <SectionTitle
        title={t("pages.recentActivity")}
        right={
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-soft)]">
            <span className="w-2 h-2 rounded-full bg-[var(--teal)] animate-pulse" />
            live
          </span>
        }
      />
      {!loaded && items.length === 0 ? (
        <div className="text-sm text-[var(--ink-soft)] py-4">…</div>
      ) : items.length === 0 ? (
        <EmptyState message={t("pages.activityEmpty")} />
      ) : (
        <ul className="flex flex-col">
          {items.slice(0, 12).map((item, i) => (
            <li
              key={`${item.kind}-${item.at}-${i}`}
              className={cn(
                "flex items-start gap-2.5 py-2 border-b border-[var(--line)] last:border-b-0",
                i === 0 && "saksham-slide-in",
              )}
            >
              <span className="text-[var(--navy)] mt-0.5 shrink-0">
                {KIND_ICONS[item.kind] ?? <Activity size={15} />}
              </span>
              <div className="min-w-0 flex-1 text-sm">
                {item.kind === "assessment:submitted" ? (
                  <>
                    <span className="font-medium">
                      {t("pages.activityScored", {
                        name: item.userName ?? "",
                        score: Number(item.score ?? 0),
                        title: String(item.assessmentTitle ?? ""),
                      })}
                    </span>
                    {item.newLevel !== item.prevLevel ? (
                      <span className="text-[var(--teal)]">
                        {" "}
                        · {t("pages.activityLevel", {
                          prev: Number(item.prevLevel ?? 0),
                          new: Number(item.newLevel ?? 0),
                        })}
                      </span>
                    ) : null}
                  </>
                ) : item.kind === "competency:updated" ? (
                  <span className="font-medium">
                    {item.userName} · {String(item.competency)}{" "}
                    {t("pages.activityLevel", {
                      prev: Number(item.prevLevel ?? 0),
                      new: Number(item.newLevel ?? 0),
                    })}
                  </span>
                ) : (
                  <span className="font-medium">
                    {t("pages.activityAssigned", {
                      name: item.userName ?? "",
                      title: String(item.title ?? ""),
                    })}
                  </span>
                )}
              </div>
              <span className="text-xs text-[var(--ink-soft)] shrink-0">
                {timeAgo(item.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
