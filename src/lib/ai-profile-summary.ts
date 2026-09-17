/**
 * AI Profile Summary generator (server-side only).
 *
 * Called fire-and-forget right after an assessment attempt is submitted
 * (see the submit route). Builds a "whole profile" snapshot — all past
 * attempts, current competency levels, and assignment history, not just the
 * attempt just submitted — sends it to the ai-service's /summarize-profile
 * endpoint (which itself falls back OpenRouter -> NVIDIA), and caches the
 * result via the Store so the Result page / trainer / admin views never have
 * to call the LLM live. Regenerated only on the next new submission.
 */

import type { Store } from "@/lib/store";

/**
 * Mirrors `ProfileSummaryInput` in mini-services/ai-service/index.ts.
 * Duplicated (not imported) on purpose: the ai-service is a separate Bun
 * process/project and must not be pulled into the Next.js TS build.
 */
type ProfileSummaryInput = {
  userName: string;
  designation: string | null;
  department: string | null;
  competencies: Array<{ name: string; current: number; required: number }>;
  attempts: Array<{
    assessmentTitle: string;
    assessmentCompetency: string;
    score: number | null;
    prevLevel: number | null;
    newLevel: number | null;
    submittedAt: string | null;
  }>;
  assignments: Array<{
    title: string;
    type: string;
    status: string;
  }>;
};

function aiServiceHttpUrl(): string {
  // ai-service now serves /summarize-profile on the same port as its
  // socket.io server (3003) — see the port-sharing note in
  // mini-services/ai-service/index.ts. AI_SERVICE_HTTP_URL can still
  // override this for local dev if you're running an older split-port
  // build of ai-service.
  return process.env.AI_SERVICE_HTTP_URL ?? "http://localhost:3003";
}

/**
 * Fetches the user's full profile from the Store, requests a fresh AI
 * summary, and caches it. Safe to call fire-and-forget (`void ...`) from an
 * API route — failures are logged and swallowed so a slow/unreachable
 * ai-service never affects the submit response.
 */
export async function regenerateProfileSummary(
  store: Store,
  userId: string,
  triggeringAttemptId: string,
): Promise<void> {
  try {
    const [user, competencies, attempts, assignments] = await Promise.all([
      store.getUserById(userId),
      store.getCompetencies(userId),
      store.listAttemptsByUser(userId),
      store.listAssignmentsForAssignee(userId),
    ]);
    if (!user) return;

    const submitted = attempts
      .filter((a) => a.submittedAt)
      .sort((a, b) => (b.submittedAt! > a.submittedAt! ? 1 : -1));

    const profile: ProfileSummaryInput = {
      userName: user.name,
      designation: user.designation,
      department: user.department,
      competencies: competencies.map((c) => ({
        name: c.name,
        current: c.current,
        required: c.required,
      })),
      attempts: submitted.map((a) => ({
        assessmentTitle: a.assessmentTitle,
        assessmentCompetency: a.assessmentCompetency,
        score: a.score,
        prevLevel: a.prevLevel,
        newLevel: a.newLevel,
        submittedAt: a.submittedAt ? a.submittedAt.toISOString() : null,
      })),
      assignments: assignments.map((a) => ({
        title: a.type === "COURSE" ? (a.courseId ?? "Course") : (a.assessmentId ?? "Assessment"),
        type: a.type,
        status: a.status,
      })),
    };

    const secret = process.env.AI_SERVICE_SECRET;
    const res = await fetch(`${aiServiceHttpUrl()}/summarize-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "x-ai-service-secret": secret } : {}),
      },
      body: JSON.stringify({ profile }),
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      console.warn(`[ai-profile-summary] ai-service returned ${res.status}`);
      return;
    }

    const data = (await res.json()) as {
      content?: string;
      provider?: "openrouter" | "nvidia" | "openai" | "custom" | "mock";
      model?: string;
    } | null;
    if (!data?.content) return;

    // Store adapters only declare openrouter/nvidia/mock in their type; a
    // legacy openai/custom provider result is recorded as "mock" for
    // display purposes (still real content, just not one of the two
    // primary providers the UI badges).
    const provider: "openrouter" | "nvidia" | "mock" =
      data.provider === "openrouter" || data.provider === "nvidia" ? data.provider : "mock";

    await store.saveAiProfileSummary({
      userId,
      summary: data.content,
      provider,
      model: data.model ?? "unknown",
      basedOnAttemptId: triggeringAttemptId,
    });
  } catch (e) {
    console.warn("[ai-profile-summary] generation failed (non-fatal):", e);
  }
}
