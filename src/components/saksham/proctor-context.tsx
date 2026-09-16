"use client";

/**
 * ProctorProvider — full port of the original proctor.js.
 *
 * Implements the same UX as the vanilla prototype:
 *   1. User clicks "Start assessment" → navigates to a proctor-check page.
 *   2. Proctor-check page asks for camera + mic permission and shows a live
 *      preview, plus a list of rules.
 *   3. User clicks "Enter fullscreen & start" → enters fullscreen, attaches
 *      visibility/blur/fullscreen/copy/paste/contextmenu listeners.
 *   4. During the quiz, a sticky "proctor bar" shows the live camera preview
 *      and the warning count.
 *   5. Violations (tab switch, lost focus, exit fullscreen, copy/paste) are
 *      logged. After `maxWarnings` (default 3) the assessment auto-submits.
 *   6. On submit (manual or auto), listeners are detached, fullscreen exited,
 *      camera/mic stopped, and the proctor summary is recorded for the result
 *      page to display.
 *
 * The camera stream is purely local — nothing is uploaded or recorded.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useToast } from "@/hooks/use-toast";

type Violation = { reason: string; at: string };

type ProctorState = {
  // Device check
  checking: boolean;
  cameraOk: boolean;
  micOk: boolean;
  deviceError: string | null;
  stream: MediaStream | null;
  // Active session
  active: boolean;
  violations: Violation[];
  warningCount: number;
  maxWarnings: number;
  terminated: boolean;
  terminatedReason: string | null;
  toast: string | null;
  // Last session summary (consumed by the result page)
  lastSummary: {
    violations: Violation[];
    terminatedReason: string | null;
  } | null;
  // Current assessment target
  pendingAssessmentId: string | null;
  pendingKind: "assessment" | "exam";
};

type ProctorContextValue = ProctorState & {
  /** Begin the device-check phase for the given assessment. */
  beginCheck: (assessmentId: string, kind?: "assessment" | "exam") => void;
  /** Re-request camera + mic (used by the "Grant access" button). */
  requestDevices: () => Promise<void>;
  /** Cancel out of the device-check page. */
  cancelCheck: () => void;
  /** Enter fullscreen, attach listeners, mark active. */
  startExam: () => Promise<void>;
  /** Detach listeners, exit fullscreen, stop devices, record summary. */
  endExam: () => void;
  /** Force-end the proctored session from inside the quiz (Exit button). */
  exitQuiz: () => void;
  /** Show a transient toast message. */
  showToast: (msg: string) => void;
};

const ProctorContext = createContext<ProctorContextValue | null>(null);

const DEFAULTS: Omit<
  ProctorState,
  "pendingAssessmentId" | "pendingKind"
> = {
  checking: false,
  cameraOk: false,
  micOk: false,
  deviceError: null,
  stream: null,
  active: false,
  violations: [],
  warningCount: 0,
  maxWarnings: 3,
  terminated: false,
  terminatedReason: null,
  toast: null,
  lastSummary: null,
};

export function ProctorProvider({ children }: { children: ReactNode }) {
  const { toast: showToastFn } = useToast();
  const [state, setState] = useState<ProctorState>({
    ...DEFAULTS,
    pendingAssessmentId: null,
    pendingKind: "assessment",
  });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoElementsRef = useRef<Set<HTMLVideoElement>>(new Set());

  /* ---------- Device management ---------- */

  const stopDevices = useCallback(() => {
    setState((s) => {
      if (s.stream) {
        s.stream.getTracks().forEach((t) => t.stop());
      }
      return { ...s, stream: null, cameraOk: false, micOk: false };
    });
  }, []);

  const requestDevices = useCallback(async () => {
    setState((s) => ({ ...s, checking: true, deviceError: null }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener("ended", () =>
          setState((s) => ({ ...s, cameraOk: false })),
        ),
      );
      stream.getAudioTracks().forEach((track) =>
        track.addEventListener("ended", () =>
          setState((s) => ({ ...s, micOk: false })),
        ),
      );
      setState((s) => ({
        ...s,
        checking: false,
        stream,
        cameraOk: stream.getVideoTracks().length > 0,
        micOk: stream.getAudioTracks().length > 0,
      }));
    } catch (e) {
      const err = e as Error;
      const deviceError =
        err.name === "NotAllowedError"
          ? "Camera/microphone permission was denied. Please allow access to continue."
          : "Could not access your camera or microphone. Check that no other app is using them.";
      setState((s) => ({
        ...s,
        checking: false,
        cameraOk: false,
        micOk: false,
        deviceError,
      }));
    }
  }, []);

  /* ---------- Fullscreen ---------- */

  const enterFullscreen = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (typeof el.webkitRequestFullscreen === "function") {
        await el.webkitRequestFullscreen();
      }
    } catch {
      /* ignore — fullscreen is best-effort */
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  const isFullscreen = useCallback(
    () => !!(document.fullscreenElement || (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement),
    [],
  );

  /* ---------- Violations ---------- */

  const showToast = useCallback(
    (msg: string) => {
      setState((s) => ({ ...s, toast: msg }));
      showToastFn({ title: msg, duration: 2500 });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setState((s) => ({ ...s, toast: null }));
      }, 3500);
    },
    [showToastFn],
  );

  // recordViolation needs to be stable but read the latest state. We use a
  // ref to hold a "terminated" flag and read state via functional updates.
  const terminatedRef = useRef(false);
  const recordViolation = useCallback(
    (reason: string) => {
      setState((s) => {
        if (!s.active || terminatedRef.current) return s;
        const violations = [
          ...s.violations,
          { reason, at: new Date().toLocaleTimeString() },
        ];
        const warningCount = s.warningCount + 1;
        showToast(
          `⚠ ${reason} (${warningCount}/${s.maxWarnings} warnings)`,
        );
        if (warningCount >= s.maxWarnings) {
          // Mark terminated — the quiz page is responsible for calling
          // submitAssessment with the terminated reason.
          terminatedRef.current = true;
          return {
            ...s,
            violations,
            warningCount,
            terminated: true,
            terminatedReason: "Too many proctoring violations.",
          };
        }
        return { ...s, violations, warningCount };
      });
    },
    [showToast],
  );

  /* ---------- Event listeners ---------- */

  useEffect(() => {
    if (!state.active) return;

    const onVisibility = () => {
      if (document.hidden) recordViolation("You switched away from the assessment tab.");
    };
    const onBlur = () => {
      if (!document.hidden) recordViolation("The assessment window lost focus.");
    };
    const onFullscreenChange = () => {
      if (!isFullscreen()) recordViolation("You exited fullscreen mode.");
    };
    const onCopyPaste = (e: Event) => {
      const type = e.type;
      const label =
        type === "copy"
          ? "Copying"
          : type === "paste"
            ? "Pasting"
            : "Right-click menu";
      recordViolation(`${label} is not allowed during the assessment.`);
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("copy", onCopyPaste);
    document.addEventListener("paste", onCopyPaste);
    document.addEventListener("contextmenu", onCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("copy", onCopyPaste);
      document.removeEventListener("paste", onCopyPaste);
      document.removeEventListener("contextmenu", onCopyPaste);
    };
  }, [state.active, recordViolation, isFullscreen]);

  /* ---------- Attaching video elements ---------- */

  /** Register a <video> element to receive the live camera stream. */
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    videoElementsRef.current.add(el);
    setState((s) => {
      if (s.stream && el.srcObject !== s.stream) {
        el.srcObject = s.stream;
      }
      return s;
    });
    return () => {
      videoElementsRef.current.delete(el);
    };
  }, []);

  // Whenever the stream changes, push it to all registered <video> elements.
  useEffect(() => {
    if (!state.stream) return;
    videoElementsRef.current.forEach((el) => {
      if (el.srcObject !== state.stream) el.srcObject = state.stream;
    });
  }, [state.stream]);

  /* ---------- Public actions ---------- */

  const beginCheck = useCallback(
    (assessmentId: string, kind: "assessment" | "exam" = "assessment") => {
      terminatedRef.current = false;
      setState((s) => ({
        ...DEFAULTS,
        pendingAssessmentId: assessmentId,
        pendingKind: kind,
        // Preserve lastSummary across begin-check so the result page can still
        // read the previous session's summary until a new one is recorded.
        lastSummary: s.lastSummary,
      }));
    },
    [],
  );

  const cancelCheck = useCallback(() => {
    stopDevices();
    setState((s) => ({
      ...s,
      pendingAssessmentId: null,
      stream: null,
      cameraOk: false,
      micOk: false,
    }));
  }, [stopDevices]);

  const startExam = useCallback(async () => {
    terminatedRef.current = false;
    await enterFullscreen();
    setState((s) => ({
      ...s,
      active: true,
      violations: [],
      warningCount: 0,
      terminated: false,
      terminatedReason: null,
    }));
  }, [enterFullscreen]);

  const endExam = useCallback(() => {
    setState((s) => {
      // Record the summary for the result page to consume.
      const lastSummary = {
        violations: s.violations,
        terminatedReason: s.terminatedReason,
      };
      return { ...s, active: false, lastSummary };
    });
    exitFullscreen();
    stopDevices();
  }, [exitFullscreen, stopDevices]);

  const exitQuiz = useCallback(() => {
    endExam();
  }, [endExam]);

  const value: ProctorContextValue = {
    ...state,
    beginCheck,
    requestDevices,
    cancelCheck,
    startExam,
    endExam,
    exitQuiz,
    showToast,
    // attachVideo is exposed via a separate hook below.
  };

  return (
    <ProctorContext.Provider value={value}>
      {children}
    </ProctorContext.Provider>
  );
}

export function useProctor() {
  const ctx = useContext(ProctorContext);
  if (!ctx) throw new Error("useProctor must be used inside <ProctorProvider>");
  return ctx;
}

/** Hook that returns a ref-callback for <video> elements that should show the
 * live proctor camera stream. */
export function useProctorVideo() {
  const stream = useProctorStream();
  return useCallback(
    (el: HTMLVideoElement | null) => {
      if (!el) return;
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
      }
    },
    [stream],
  );
}

/** Convenience hook that just returns the raw MediaStream. */
export function useProctorStream(): MediaStream | null {
  const ctx = useContext(ProctorContext);
  return ctx?.stream ?? null;
}
