"use client";

/**
 * Proctored assessment pre-check page.
 *
 * Shown after the user clicks "Start assessment" on the Assess/Exam tab.
 * Asks for camera + mic permission, shows a live preview, and lists the
 * rules. Once both devices are OK, the user can click "Enter fullscreen &
 * start" to begin the actual quiz.
 */

import { useEffect } from "react";
import { useProctor, useProctorVideo } from "@/components/saksham/proctor-context";
import { useQuiz } from "@/components/saksham/quiz-context";
import { useAuth } from "@/lib/auth-context";
import { useT } from "@/lib/lang-context";
import { PageHeader, EmptyState } from "@/components/saksham/primitives";
import { Camera, Mic, X, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProctorCheckPage() {
  const proctor = useProctor();
  const quiz = useQuiz();
  const { data } = useAuth();
  const t = useT();
  const videoRef = useProctorVideo();

  // Auto-request devices on mount.
  useEffect(() => {
    if (!proctor.cameraOk && !proctor.micOk && !proctor.checking) {
      proctor.requestDevices();
    }
  }, [proctor.cameraOk, proctor.micOk, proctor.checking, proctor.requestDevices]);

  if (!data || !quiz.assessmentId) {
    return <EmptyState message={t("pages.assessmentNotFound")} />;
  }

  const localMeta =
    quiz.kind === "exam"
      ? data.exams.find((a) => a.id === quiz.assessmentId)
      : data.assessments.find((a) => a.id === quiz.assessmentId);
  // Trainer-assigned AI-generated tests only exist in Mongo, not the static
  // seed JSON — fall back to the meta the quiz context fetched from the
  // server when starting the attempt.
  const meta = localMeta ?? quiz.serverAssessment;
  if (!meta) {
    if (quiz.assessmentLoading) {
      return <EmptyState message="Loading assessment…" />;
    }
    return <EmptyState message={t("pages.assessmentNotFound")} />;
  }

  const canStart = proctor.cameraOk && proctor.micOk && !proctor.checking;

  const rules = [
    t("common.proctorRule1"),
    t("common.proctorRule2"),
    t("common.proctorRule3"),
    t("common.proctorRule4", { max: proctor.maxWarnings }),
    t("common.proctorRule5"),
  ];

  return (
    <>
      <PageHeader
        title={t("common.proctorCheckTitle")}
        subtitle={meta.title}
        right={
          <button
            type="button"
            onClick={() => quiz.exitTo("list")}
            className="saksham-btn-secondary h-9"
          >
            {t("common.proctorCancel")}
          </button>
        }
      />

      <div className="bg-white rounded-xl border border-[var(--line)] p-5 max-w-3xl">
        {/* Preview box */}
        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-5">
          <div className="bg-[var(--paper)] rounded-lg aspect-video overflow-hidden grid place-items-center border border-[var(--line)]">
            {proctor.stream ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-xs text-[var(--ink-soft)] text-center p-4">
                {proctor.deviceError || t("common.proctorPreviewPlaceholder")}
              </div>
            )}
          </div>

          {/* Device checks */}
          <div className="space-y-2.5">
            <DeviceRow
              icon={<Camera size={16} />}
              label={
                proctor.checking
                  ? t("common.proctorRequestingCamera")
                  : proctor.cameraOk
                    ? t("common.proctorCameraOk")
                    : t("common.proctorCameraFail")
              }
              status={
                proctor.checking
                  ? "pending"
                  : proctor.cameraOk
                    ? "ok"
                    : "fail"
              }
            />
            <DeviceRow
              icon={<Mic size={16} />}
              label={
                proctor.checking
                  ? t("common.proctorRequestingMic")
                  : proctor.micOk
                    ? t("common.proctorMicOk")
                    : t("common.proctorMicFail")
              }
              status={
                proctor.checking
                  ? "pending"
                  : proctor.micOk
                    ? "ok"
                    : "fail"
              }
            />
            {proctor.deviceError ? (
              <div className="text-xs text-[var(--critical)] bg-[var(--critical-soft)] rounded-md px-3 py-2">
                {proctor.deviceError}
              </div>
            ) : null}
          </div>
        </div>

        {/* Rules */}
        <div className="mt-5 pt-5 border-t border-[var(--line)]">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={16} className="text-[var(--teal)]" />
            <div className="font-semibold text-sm">{t("common.proctorBeforeBegin")}</div>
          </div>
          <ul className="text-sm text-[var(--ink-soft)] space-y-1.5 list-disc pl-5">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => quiz.exitTo("list")}
            className="saksham-btn-secondary"
          >
            {t("common.exit")}
          </button>
          {canStart ? (
            <button
              type="button"
              onClick={async () => {
                await proctor.startExam();
                quiz.exitTo("quiz");
              }}
              className="saksham-btn-primary"
            >
              {t("common.proctorEnterStart")}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => proctor.requestDevices()}
              disabled={proctor.checking}
              className="saksham-btn-primary"
            >
              {proctor.checking ? t("common.proctorChecking") : t("common.proctorGrantAccess")}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function DeviceRow({
  icon,
  label,
  status,
}: {
  icon: React.ReactNode;
  label: string;
  status: "pending" | "ok" | "fail";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm",
        status === "ok" && "bg-[var(--good-soft)] text-[var(--good)]",
        status === "fail" && "bg-[var(--critical-soft)] text-[var(--critical)]",
        status === "pending" &&
          "bg-[var(--medium-soft)] text-[var(--medium)]",
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="shrink-0">
        {status === "ok" ? "✓" : status === "fail" ? <X size={14} /> : "…"}
      </span>
    </div>
  );
}
