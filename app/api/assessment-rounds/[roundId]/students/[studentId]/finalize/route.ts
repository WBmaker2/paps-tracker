import { NextRequest, NextResponse } from "next/server";
import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../../../../../src/lib/teacher-route-context";
type Context = { params: Promise<{ roundId: string; studentId: string }> };
const fail = (code: string, status: number) => NextResponse.json({ error: { code, message: code, requestId: crypto.randomUUID() } }, { status });
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireTeacherRouteSession(); if (!auth.ok) return auth.response;
  const { roundId, studentId } = await context.params; const body = await request.json().catch(() => ({}));
  const expectedRevision = Number(body.expectedResultRevision); const key = request.headers.get("Idempotency-Key")?.trim(); const match = request.headers.get("If-Match-Revision");
  if (!Number.isInteger(expectedRevision) || !key || match !== String(expectedRevision)) return fail("INVALID_REQUEST", 400);
  try {
    const { store, teacher } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({ request, teacherEmail: auth.session.email, createStore: createTeacherRuntimeStoreForRequest });
    if (!store.getAssessmentRound || !store.finalizeStudentRound) return fail("STORAGE_UNAVAILABLE", 503);
    const round = await store.getAssessmentRound(roundId); if (round.schoolId !== teacher.schoolId) return fail("FORBIDDEN", 403);
    const outcome = await store.finalizeStudentRound({ roundId, studentId, expectedRevision, teacherId: teacher.id, idempotencyKey: key });
    return NextResponse.json({ result: outcome.result, roundRevision: round.revision, replayed: outcome.replayed, requestId: crypto.randomUUID() }, { status: outcome.replayed ? 200 : 201 });
  } catch (error) { const code = error instanceof Error ? error.message : "STORAGE_UNAVAILABLE"; const status = code === "FORBIDDEN" ? 403 : code === "STUDENT_NOT_FOUND" ? 404 : code === "REVISION_CONFLICT" || code === "RESULT_INCOMPLETE" || code === "RESULT_EXCLUDED" || code === "IDEMPOTENCY_KEY_REUSED" ? 409 : 500; return fail(code, status); }
}
