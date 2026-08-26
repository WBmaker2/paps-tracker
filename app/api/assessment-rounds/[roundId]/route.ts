import { NextRequest, NextResponse } from "next/server";
import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../../src/lib/teacher-route-context";

type Context = { params: Promise<{ roundId: string }> };
const fail = (code: string, status: number) => NextResponse.json({ error: { code, message: code, requestId: crypto.randomUUID() } }, { status });

export async function GET(request: NextRequest, context: Context) {
  const auth = await requireTeacherRouteSession();
  if (!auth.ok) return auth.response;
  const { roundId } = await context.params;
  try {
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({ request, teacherEmail: auth.session.email, createStore: createTeacherRuntimeStoreForRequest });
    if (!store.getAssessmentRound || !store.listStudentRoundResults) return fail("STORAGE_UNAVAILABLE", 503);
    const round = await store.getAssessmentRound(roundId);
    if (round.schoolId !== teacher.schoolId) return fail("FORBIDDEN", 403);
    const responseRound = { ...round };
    delete responseRound.creationIdempotencyKey;
    const sessions = bootstrap.sessions.filter((session) => Object.values(round.sessionIdsByFactor).includes(session.id));
    const classIds = new Set(round.classTargets.map((target) => target.classId));
    const students = bootstrap.students.filter((student) => classIds.has(student.classId));
    const results = await store.listStudentRoundResults(roundId);
    return NextResponse.json({ round: responseRound, sessions, students: students.map(({ id, name, gradeLevel, classId, studentNumber, active }) => ({ id, name, gradeLevel, classId, classNumber: bootstrap.classes.find((entry) => entry.id === classId)?.classNumber ?? null, studentNumber: studentNumber ?? null, active: active !== false })), results, roundRevision: round.revision, generatedAt: new Date().toISOString(), requestId: crypto.randomUUID() });
  } catch (error) {
    return fail(error instanceof Error && error.message === "FORBIDDEN" ? "FORBIDDEN" : "ROUND_NOT_FOUND", error instanceof Error && error.message === "FORBIDDEN" ? 403 : 404);
  }
}
