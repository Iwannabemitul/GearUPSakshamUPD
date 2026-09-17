"use client";

/**
 * NotificationCenter (C.8) — topbar bell + dropdown of recent notifications.
 *
 * Live events land here as they arrive; the list is also seeded from the
 * current session's activity. Employees see assignments received; trainers
 * and admins see submissions, completions and competency changes.
 */

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/lang-context";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeEvent } from "@/lib/realtime-context";
import {
  Bell,
  ClipboardCheck,
  Award,
  Send,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  at: string;
  read: boolean;
};

const KIND_ICON: Record<string, React.ReactNode> = {
  "assessment:submitted": <ClipboardCheck size={14} />,
  "assignment:completed": <ClipboardCheck size={14} />,
  "assignment:created": <Send size={14} />,
  "competency:updated": <Award size={14} />,
};

export function NotificationCenter() {
  const t = useT();
  const { session } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const push = useCallback((n: Notification) => {
    setItems((prev) => [n, ...prev].slice(0, 30));
  }, []);

  // Live event handlers.
  useRealtimeEvent("assessment:submitted", (payload) => {
    const p = payload as { attemptId?: string; userName?: string; assessmentTitle?: string; score?: number };
    if (!p?.attemptId || (session?.role ?? "employee") === "employee") return;
    push({
      id: `att-${p.attemptId}`,
      kind: "assessment:submitted",
      title: `${p.userName} — ${p.assessmentTitle}`,
      detail: `${p.score}%`,
      at: new Date().toISOString(),
      read: false,
    });
  });

  useRealtimeEvent("assignment:created", (payload) => {
    const p = payload as { id?: string; assigneeName?: string; assessmentId?: string; courseId?: string; assessmentTitle?: string; courseTitle?: string };
    if (!p?.id) return;
    push({
      id: `asn-${p.id}`,
      kind: "assignment:created",
      title: `${p.assigneeName ?? ""}`,
      detail: p.assessmentTitle ?? p.courseTitle ?? p.assessmentId ?? p.courseId ?? "",
      at: new Date().toISOString(),
      read: false,
    });
  });

  useRealtimeEvent("competency:updated", (payload) => {
    const p = payload as { userId?: string; userName?: string; competency?: string; newLevel?: number };
    if (!p?.userId || (session?.role ?? "employee") === "employee") return;
    push({
      id: `cmp-${p.userId}-${p.competency}-${p.newLevel}`,
      kind: "competency:updated",
      title: `${p.userName} — ${p.competency}`,
      detail: `L${p.newLevel}`,
      at: new Date().toISOString(),
      read: false,
    });
  });

  const unread = items.filter((n) => !n.read).length;

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={`${t("pages.notifications")}${unread > 0 ? ` (${unread})` : ""}`}
          className="relative h-9 w-9 rounded-md"
        >
          <Bell size={16} />
          {unread > 0 ? (
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--critical)] text-white text-[10px] font-bold grid place-items-center"
              aria-hidden="true"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--line)] sticky top-0 bg-white">
          <span className="font-semibold text-sm">
            {t("pages.notifications")}
          </span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-[var(--teal)] hover:underline"
            >
              {t("pages.markAllRead")}
            </button>
          ) : null}
        </div>
        {items.length === 0 ? (
          <div className="px-3 py-6 text-sm text-[var(--ink-soft)] text-center">
            {t("pages.notificationsEmpty")}
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-2.5 px-3 py-2.5 border-b border-[var(--line)] last:border-b-0 text-sm",
                !n.read && "bg-[var(--teal-soft)]/40",
              )}
            >
              <span className="text-[var(--navy)] mt-0.5 shrink-0">
                {KIND_ICON[n.kind] ?? <Bell size={14} />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{n.title}</div>
                <div className="text-xs text-[var(--ink-soft)]">
                  {n.detail}
                </div>
              </div>
            </div>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
