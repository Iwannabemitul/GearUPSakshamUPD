"use client";

/**
 * AssignDialog — trainer/admin picks an employee + item + due date and
 * creates an assignment. The assignee receives it live (socket) and via REST
 * catch-up when offline.
 */

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/lang-context";
import { useAuth } from "@/lib/auth-context";
import { useAssignments } from "@/lib/assignments-context";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IGOT_COURSES } from "@/lib/igot-courses";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type WorkforcePerson = {
  id: string;
  name: string;
  email: string;
  designation: string | null;
  role: string;
};

export function AssignDialog({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: { type?: string; itemId?: string };
}) {
  const t = useT();
  const { data } = useAuth();
  const { create } = useAssignments();
  const { toast } = useToast();

  const [people, setPeople] = useState<WorkforcePerson[]>([]);
  // Published assessments from the DB (includes AI-generated "g-..." ones
  // that are absent from the static seed catalog).
  const [dbAssessments, setDbAssessments] = useState<
    Array<{ id: string; title: string; kind: string | null }>
  >([]);
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [type, setType] = useState<string>("ASSESSMENT");
  const [itemId, setItemId] = useState<string>("");
  const [dueAt, setDueAt] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (prefill?.type) {
      setType(prefill.type);
      setItemId(prefill.itemId ?? "");
    }
    void (async () => {
      try {
        const res = await fetch("/api/trainer/workforce");
        if (res.ok) {
          const payload = (await res.json()) as {
            workforce: WorkforcePerson[];
          };
          setPeople(payload.workforce.filter((p) => p.role !== "TRAINER"));
        }
      } catch {
        /* offline */
      }
      try {
        const res = await fetch("/api/assessments");
        if (res.ok) {
          const payload = (await res.json()) as {
            assessments?: Array<{ id: string; title: string; kind: string | null }>;
          };
          setDbAssessments(payload.assessments ?? []);
        }
      } catch {
        /* offline */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.type, prefill?.itemId]);

  // Merge DB-published assessments into the static lists (generated tests
  // only exist in the store). Dedupe by id, static catalog wins on labels.
  const items = useMemo(() => {
    const merge = (
      staticItems: Array<{ id: string; label: string }>,
      kind: "ASSESSMENT" | "EXAM",
    ) => {
      const ids = new Set(staticItems.map((i) => i.id));
      const extra = dbAssessments
        .filter(
          (a) =>
            !ids.has(a.id) &&
            (kind === "EXAM" ? a.kind === "EXAM" : a.kind !== "EXAM"),
        )
        .map((a) => ({ id: a.id, label: a.title }));
      return [...staticItems, ...extra];
    };
    if (type === "ASSESSMENT")
      return merge(
        (data?.assessments ?? []).map((a) => ({ id: a.id, label: a.title })),
        "ASSESSMENT",
      );
    if (type === "EXAM")
      return merge(
        (data?.exams ?? []).map((a) => ({ id: a.id, label: a.title })),
        "EXAM",
      );
    if (type === "COURSE") return IGOT_COURSES.map((c) => ({ id: c.id, label: c.title }));
    return (data?.learningPathSql ?? []).map((p) => ({
      id: `phase-${p.phase}`,
      label: p.title,
    }));
  }, [type, data, dbAssessments]);

  useEffect(() => {
    // Reset item when the type changes — unless it matches an active prefill.
    setItemId(type === prefill?.type && prefill?.itemId ? prefill.itemId : "");
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (!assigneeId || !itemId) return;
    setBusy(true);
    try {
      const assignee = people.find((p) => p.id === assigneeId);
      await create({
        assigneeId,
        type: type as "ASSESSMENT" | "EXAM" | "COURSE" | "LEARNING_PATH",
        assessmentId:
          type === "ASSESSMENT" || type === "EXAM" ? itemId : undefined,
        courseId: type === "COURSE" ? itemId : undefined,
        note: note || undefined,
        dueAt: dueAt || undefined,
      });
      toast({
        title: t("pages.assignSuccess", { name: assignee?.name ?? "" }),
      });
      onOpenChange(false);
      setNote("");
      setDueAt("");
    } catch (err) {
      toast({
        title: t("pages.assignFailed"),
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = Boolean(assigneeId && itemId) && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pages.assignDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.assignToEmployee")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-employee">{t("pages.assignPickEmployee")}</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger id="assign-employee" className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {p.designation ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-type">{t("pages.assignPickType")}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="assign-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASSESSMENT">Assessment</SelectItem>
                <SelectItem value="EXAM">Exam</SelectItem>
                <SelectItem value="COURSE">iGOT Course</SelectItem>
                <SelectItem value="LEARNING_PATH">Learning path</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-item">{t("pages.assignPickItem")}</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger id="assign-item" className="w-full">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {items.map((it) => (
                  <SelectItem key={it.id} value={it.id}>
                    {it.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-due">{t("pages.assignDueDate")}</Label>
            <Input
              id="assign-due"
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assign-note">{t("pages.assignNote")}</Label>
            <Textarea
              id="assign-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {t("pages.assignSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
