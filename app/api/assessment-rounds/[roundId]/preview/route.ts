import { NextRequest, NextResponse } from "next/server";
import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../../../src/lib/teacher-route-context";
type Context = { params: Promise<{ roundId: string }> };
const fail = (code: string, status: number) => NextResponse.json({ error: { code, message: code, requestId: crypto.randomUUID() } }, { status });
export async function POST(request: NextRequest, context: Context) {
  const auth = await requireTeacherRouteSession(); if (!auth.ok) return auth.response;
  const { roundId } = await context.params; const body = await request.json().catch(() => ({}));
  try {
    const { store, teacher } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({ request, teacherEmail: auth.session.email, createStore: createTeacherRuntimeStoreForRequest });
    if (!store.getAssessmentRound || !store.previewAssessmentRound) return fail("STORAGE_UNAVAILABLE", 503);
    const round = await store.getAssessmentRound(roundId); if (round.schoolId !== teacher.schoolId) return fail("FORBIDDEN", 403);
    if (body.expectedRoundRevision !== undefined && Number(body.expectedRoundRevision) !== round.revision) return fail("REVISION_CONFLICT", 409);
    const results = await store.previewAssessmentRound({ roundId, studentIds: Array.isArray(body.studentIds) ? body.studentIds : undefined });
    return NextResponse.json({ roundId, roundRevision: round.revision, results, calculatedAt: new Date().toISOString(), persisted: false, requestId: crypto.randomUUID() });
  } catch (error) { const code = error instanceof Error ? error.message : "ROUND_NOT_FOUND"; return fail(code, code === "FORBIDDEN" ? 403 : code === "REVISION_CONFLICT" ? 409 : 404); }
}
