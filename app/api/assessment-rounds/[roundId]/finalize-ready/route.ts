import { NextRequest, NextResponse } from "next/server";
import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../../../src/lib/teacher-route-context";
type Context = { params: Promise<{ roundId: string }> };
const fail = (code: string, status: number) => NextResponse.json({ error: { code, message: code, requestId: crypto.randomUUID() } }, { status });
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireTeacherRouteSession(); if (!auth.ok) return auth.response;
  const { roundId } = await context.params; const body = await request.json().catch(() => ({}));
  const expectedRoundRevision = Number(body.expectedRoundRevision); const key = request.headers.get("Idempotency-Key")?.trim();
  if (!Number.isInteger(expectedRoundRevision) || !key) return fail("INVALID_REQUEST", 400);
  try {
    const { store, teacher } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({ request, teacherEmail: auth.session.email, createStore: createTeacherRuntimeStoreForRequest });
    if (!store.getAssessmentRound || !store.previewAssessmentRound || !store.finalizeStudentRound) return fail("STORAGE_UNAVAILABLE", 503);
    const round = await store.getAssessmentRound(roundId); if (round.schoolId !== teacher.schoolId) return fail("FORBIDDEN", 403);
    if (round.revision !== expectedRoundRevision) return fail("REVISION_CONFLICT", 409);
    const previews = await store.previewAssessmentRound({ roundId, studentIds: Array.isArray(body.studentIds) ? body.studentIds : undefined });
    if (Array.isArray(body.studentIds) && previews.length !== body.studentIds.length) return fail("STUDENT_NOT_FOUND", 404);
    if (previews.some((preview) => preview.status !== "ready" && preview.status !== "stale")) return fail("RESULT_NOT_READY", 409);
    const ready = previews.filter((result) => result.status === "ready" || result.status === "stale");
    if (!ready.length) return fail("NO_READY_RESULTS", 409);
    const expected = body.expectedResultRevisions && typeof body.expectedResultRevisions === "object" ? body.expectedResultRevisions as Record<string, unknown> : {};
    if (previews.some((preview) => expected[preview.studentId] !== undefined && Number(expected[preview.studentId]) !== preview.revision)) return fail("REVISION_CONFLICT", 409);
    const results = [];
    const replayFlags: boolean[] = [];
    for (const preview of ready) {
      const result = await store.finalizeStudentRound({ roundId, studentId: preview.studentId, expectedRevision: Number(expected[preview.studentId] ?? preview.revision), teacherId: teacher.id, idempotencyKey: `${key}:${preview.studentId}` });
      results.push(result.result);
      replayFlags.push(result.replayed);
    }
    const replayed = replayFlags.length > 0 && replayFlags.every(Boolean);
    return NextResponse.json({ results, finalizedStudentIds: results.map((result) => result.studentId), roundRevision: round.revision, replayed, requestId: crypto.randomUUID() }, { status: replayed ? 200 : 201 });
  } catch (error) { const code = error instanceof Error ? error.message : "STORAGE_UNAVAILABLE"; return fail(code, code === "FORBIDDEN" ? 403 : code === "REVISION_CONFLICT" || code === "RESULT_INCOMPLETE" ? 409 : 500); }
}
