"use client";

/**
 * AssignmentsProvider — client state for the signed-in user's assignments.
 *
 * Employees see assignments they received; trainers see what they authored;
 * admins see everything (from /api/assignments). Live events update the list
 * in place: a newly created assignment slides in with a toast, status
 * transitions (STARTED/COMPLETED) update without a refetch.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth-context";
import {
  useRealtimeEvent,
  useRealtime,
} from "@/lib/realtime-context";
import { useToast } from "@/hooks/use-toast";

export type ClientAssignmentType =
  | "ASSESSMENT"
  | "EXAM"
  | "COURSE"
  | "LEARNING_PATH";

export type ClientAssignmentStatus =
  | "PENDING"
  | "STARTED"
  | "COMPLETED"
  | "EXPIRED";

export type ClientAssignment = {
  id: string;
  authorId: string;
  authorName: string | null;
  assigneeId: string;
  assigneeName: string | null;
  type: ClientAssignmentType;
  assessmentId: string | null;
  assessmentTitle?: string | null;
  courseId: string | null;
  courseTitle?: string | null;
  note: string | null;
  dueAt: string | null;
  status: ClientAssignmentStatus;
  createdAt: string;
  completedAt: string | null;
};

type AssignmentsContextValue = {
  assignments: ClientAssignment[];
  loading: boolean;
  refresh: () => Promise<void>;
  markStatus: (id: string, status: ClientAssignmentStatus) => Promise<void>;
  create: (input: {
    assigneeId: string;
    type: ClientAssignmentType;
    assessmentId?: string;
    courseId?: string;
    note?: string;
    dueAt?: string;
  }) => Promise<ClientAssignment>;
};

const AssignmentsContext = createContext<AssignmentsContextValue | null>(null);

export function AssignmentsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const { userId } = useRealtime();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<ClientAssignment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch("/api/assignments");
      if (res.ok) {
        const data = (await res.json()) as { assignments: ClientAssignment[] };
        setAssignments(data.assignments);
      }
    } catch {
      /* offline — keep current list */
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setAssignments([]);
      return;
    }
    void refresh();
  }, [session, refresh]);

  useRealtimeEvent("assignment:created", (payload) => {
    const a = payload as ClientAssignment;
    if (!a?.id) return;
    setAssignments((prev) => {
      if (prev.some((x) => x.id === a.id)) return prev;
      return [a, ...prev];
    });
    // Only toast for the recipient (trainers see it in their list silently).
    if (userId && a.assigneeId === userId) {
      toast({
        title: "New assignment received",
        description:
          a.type === "COURSE"
            ? (a.courseTitle ?? a.courseId ?? "Course")
            : (a.assessmentTitle ?? a.assessmentId ?? a.type),
      });
    }
  });

  useRealtimeEvent("assignment:updated", (payload) => {
    const a = payload as ClientAssignment;
    if (!a?.id) return;
    setAssignments((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, ...a } : x)),
    );
  });

  const markStatus = useCallback(
    async (id: string, status: ClientAssignmentStatus) => {
      // Optimistic update, then reconcile with the server response.
      setAssignments((prev) =>
        prev.map((x) =>
          x.id === id
            ? {
                ...x,
                status,
                completedAt:
                  status === "COMPLETED"
                    ? new Date().toISOString()
                    : x.completedAt,
              }
            : x,
        ),
      );
      try {
        const res = await fetch(`/api/assignments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        if (res.ok) {
          const data = (await res.json()) as { assignment: ClientAssignment };
          setAssignments((prev) =>
            prev.map((x) => (x.id === id ? data.assignment : x)),
          );
        }
      } catch {
        /* offline — optimistic state stands until refresh */
      }
    },
    [],
  );

  const create = useCallback(
    async (input: {
      assigneeId: string;
      type: ClientAssignmentType;
      assessmentId?: string;
      courseId?: string;
      note?: string;
      dueAt?: string;
    }): Promise<ClientAssignment> => {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to create assignment");
      }
      const data = (await res.json()) as { assignment: ClientAssignment };
      setAssignments((prev) =>
        prev.some((x) => x.id === data.assignment.id)
          ? prev
          : [data.assignment, ...prev],
      );
      return data.assignment;
    },
    [],
  );

  const value = useMemo<AssignmentsContextValue>(
    () => ({ assignments, loading, refresh, markStatus, create }),
    [assignments, loading, refresh, markStatus, create],
  );

  return (
    <AssignmentsContext.Provider value={value}>
      {children}
    </AssignmentsContext.Provider>
  );
}

export function useAssignments(): AssignmentsContextValue {
  const ctx = useContext(AssignmentsContext);
  if (!ctx) {
    throw new Error(
      "useAssignments must be used inside <AssignmentsProvider>",
    );
  }
  return ctx;
}
