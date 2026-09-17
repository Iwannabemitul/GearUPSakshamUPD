/**
 * Server-side display-title resolution for assignments.
 *
 * Assignments store raw ids (AssessmentMeta externalId like "e-dq" or a
 * generated "g-..." id, or an iGOT course id). Those ids are meaningless to
 * users, so the API layer enriches assignment payloads with human titles
 * before returning/fanning them out.
 */

import assessmentsJson from "@/database/assessments.json";
import { IGOT_COURSES } from "@/lib/igot-courses";
import { getStore } from "@/lib/store";

const staticTitles = new Map<string, string>();
for (const a of assessmentsJson.assessments) {
  staticTitles.set(a.id, a.title);
}
for (const e of assessmentsJson.exams) {
  staticTitles.set(e.id, e.title);
}
const courseTitles = new Map(IGOT_COURSES.map((c) => [c.id, c.title]));

export async function resolveAssignmentTitles(assignment: {
  type: string;
  assessmentId: string | null;
  courseId: string | null;
}): Promise<{ assessmentTitle: string | null; courseTitle: string | null }> {
  let assessmentTitle: string | null = null;
  if (assignment.assessmentId) {
    assessmentTitle = staticTitles.get(assignment.assessmentId) ?? null;
    if (!assessmentTitle) {
      // Generated assessments ("g-...") live only in the store.
      try {
        const meta = await getStore().getAssessmentMetaByExternalId(
          assignment.assessmentId,
        );
        assessmentTitle = meta?.title ?? null;
      } catch {
        // Store unavailable — fall back to the raw id at the call site.
      }
    }
  }
  const courseTitle = assignment.courseId
    ? (courseTitles.get(assignment.courseId) ?? null)
    : null;
  return { assessmentTitle, courseTitle };
}
