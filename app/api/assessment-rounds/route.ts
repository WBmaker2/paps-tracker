import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../src/lib/teacher-route-context";
import { assertSelectedEventsByFactor, assertUniqueRoundClassTargets, FOUR_FACTOR_RULE_SOURCE, FOUR_FACTOR_RULE_VERSION } from "../../../src/lib/paps/assessment-round";
import { FOUR_FACTOR_IDS } from "../../../src/lib/paps/four-factor-score";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import type { AssessmentRoundType, PAPSAssessmentRound, PAPSSession, PAPSFourFactorId, GradeLevel } from "../../../src/lib/paps/types";
import { createStudentSessionGroupUrl } from "../../../src/lib/student-session-access";

const errorResponse = (code: string, status: number, message = code) => NextResponse.json({ error: { code, message, requestId: randomUUID() } }, { status });
const parseRoundType = (value: unknown): AssessmentRoundType => value === "followUp" ? "followUp" : value === "regular" ? "regular" : (() => { throw new Error("INVALID_REQUEST"); })();
const idempotencyKey = (request: NextRequest): string => {
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 128) throw new Error("INVALID_REQUEST");
  return key;
};

export async function POST(request: NextRequest) {
  const auth = await requireTeacherRouteSession();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return errorResponse("INVALID_JSON", 400); }
  try {
    const key = idempotencyKey(request);
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({ request, teacherEmail: auth.session.email, createStore: createTeacherRuntimeStoreForRequest });
    if (!store.createAssessmentRound) return errorResponse("STORAGE_UNAVAILABLE", 503);
    const selectedEventsByFactor = assertSelectedEventsByFactor(body.selectedEventsByFactor);
    const classTargetInput = Array.isArray(body.classTargets) ? body.classTargets : [];
    if (classTargetInput.length === 0 || classTargetInput.length > 2) throw new Error("INVALID_REQUEST");
    const classTargets = classTargetInput.map((entry) => {
      const classId = typeof entry === "string" ? entry : (entry as { classId?: unknown })?.classId;
      const classroom = bootstrap.classes.find((candidate) => candidate.id === classId);
      if (!classroom || classroom.schoolId !== teacher.schoolId) throw new Error("FORBIDDEN");
      return { classId: classroom.id, gradeLevel: classroom.gradeLevel };
    });
    assertUniqueRoundClassTargets(classTargets);
    const sessionType = body.sessionType === "official" || body.sessionType === "practice" ? body.sessionType : (() => { throw new Error("INVALID_REQUEST"); })();
    const roundId = randomUUID();
    const roundName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "체지방 제외 4요인 평가 회차";
    if (roundName.length > 200) throw new Error("INVALID_REQUEST");
    const academicYear = Number(body.academicYear);
    const roundNumber = Number(body.roundNumber);
    if (!Number.isInteger(academicYear) || academicYear < 2000 || !Number.isInteger(roundNumber) || roundNumber < 1) throw new Error("INVALID_REQUEST");
    const createdAt = new Date().toISOString();
    const sessionGroupId = roundId;
    const sessions = FOUR_FACTOR_IDS.map((factorId, index): PAPSSession => ({
      id: randomUUID(), schoolId: teacher.schoolId, teacherId: teacher.id,
      academicYear, name: `${roundName} - ${getEventDefinition(selectedEventsByFactor[factorId]).label}`,
      gradeLevel: classTargets[0]!.gradeLevel, sessionType, classScope: classTargets.length === 2 ? "split" : "single",
      eventId: selectedEventsByFactor[factorId], classTargets: classTargets.map((target) => ({ classId: target.classId, eventId: selectedEventsByFactor[factorId] })),
      sessionGroupId, sessionGroupName: roundName, sessionGroupOrder: index, assessmentRoundId: roundId, factorId,
      isOpen: body.openImmediately !== false, createdAt
    }));
    const round: PAPSAssessmentRound = {
      id: roundId, name: roundName, academicYear: Number(body.academicYear) || new Date().getUTCFullYear(), schoolId: teacher.schoolId, teacherId: teacher.id,
      roundType: parseRoundType(body.roundType), roundNumber, status: body.openImmediately === false ? "draft" : "open",
      classTargets, selectedEventsByFactor, sessionIdsByFactor: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, sessions[index]!.id])) as Record<PAPSFourFactorId, string>,
      ruleVersion: FOUR_FACTOR_RULE_VERSION,
      ruleSource: FOUR_FACTOR_RULE_SOURCE,
      revision: 1, createdAt, openedAt: body.openImmediately === false ? null : createdAt, finalizedAt: null, archivedAt: null, creationIdempotencyKey: key
    };
    const created = await store.createAssessmentRound({ round, sessions, idempotencyKey: key });
    const spreadsheetId = request.cookies.get("paps-spreadsheet-id")?.value ?? "local";
    const responseRound = { ...created.round };
    delete responseRound.creationIdempotencyKey;
    return NextResponse.json({ round: responseRound, sessions: created.sessions, studentSessionUrl: createStudentSessionGroupUrl({ sessionGroupId: responseRound.id, spreadsheetId }), roundRevision: responseRound.revision, requestId: randomUUID(), idempotencyKey: key }, { status: 201 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_REQUEST";
    const status = code === "FORBIDDEN" ? 403 : code === "EVENT_NOT_ELIGIBLE" || code === "INVALID_FACTOR_SET" || code === "INVALID_REQUEST" ? 400 : code === "STORAGE_UNAVAILABLE" ? 503 : 409;
    return errorResponse(code, status);
  }
}
