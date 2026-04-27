import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../src/lib/google/sheets-store";
import { PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../../src/lib/teacher-live-update-protocol";
import { publishTeacherLiveUpdate } from "../../../src/lib/teacher-live-updates";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import type { AuthorizedTeacherRouteContext } from "../../../src/lib/teacher-route-context";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../src/lib/teacher-route-context";
import { buildTeacherStateVersion } from "../../../src/lib/google/sheet-state-version";
import { getEventDefinition, isKnownEventId } from "../../../src/lib/paps/catalog";
import { validateSession } from "../../../src/lib/paps/validation";
import type { EventId, GradeLevel, PAPSSession, PAPSTeacher, SessionType } from "../../../src/lib/paps/types";
import {
  createStudentSessionGroupUrl,
  createStudentSessionUrl
} from "../../../src/lib/student-session-access";

const parseSessionType = (value: unknown): SessionType => {
  if (value === "official" || value === "practice") {
    return value;
  }

  throw new Error("A valid session type is required.");
};

const parseEventId = (value: unknown, fieldName: string): EventId => {
  if (isKnownEventId(value)) {
    return value;
  }

  throw new Error(`${fieldName} is required.`);
};

const parseEventIds = (value: unknown, fallbackEventId: EventId): EventId[] => {
  if (!Array.isArray(value)) {
    return [fallbackEventId];
  }

  const eventIds = value.map((entry) => parseEventId(entry, "Event"));

  return Array.from(new Set(eventIds));
};

const sortSessionsByGroupOrder = (sessions: PAPSSession[]): PAPSSession[] =>
  [...sessions].sort(
    (left, right) =>
      (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
      (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
      left.id.localeCompare(right.id)
  );

const resolveExistingSessions = (
  body: Record<string, unknown>,
  context: AuthorizedTeacherRouteContext<TeacherCrudStore>
): PAPSSession[] => {
  const sessionGroupId =
    typeof body.sessionGroupId === "string" && body.sessionGroupId.trim()
      ? body.sessionGroupId.trim()
      : null;
  const sessionId =
    typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;

  if (sessionGroupId) {
    const matchingSessions = sortSessionsByGroupOrder(
      context.bootstrap.sessions.filter((session) => session.sessionGroupId === sessionGroupId)
    );

    if (matchingSessions.length === 0) {
      throw new Error(`Session group ${sessionGroupId} was not found.`);
    }

    return matchingSessions;
  }

  if (!sessionId) {
    return [];
  }

  const existingSession = context.bootstrap.sessions.find((session) => session.id === sessionId);

  if (!existingSession) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  return [existingSession];
};

const getSessionStructureSnapshot = (sessions: PAPSSession[]) => {
  const orderedSessions = sortSessionsByGroupOrder(sessions);
  const firstSession = orderedSessions[0];

  return {
    sessionType: firstSession?.sessionType ?? "practice",
    classScope: firstSession?.classScope ?? "single",
    primaryClassId: firstSession?.classTargets[0]?.classId ?? "",
    secondaryClassId: firstSession?.classTargets[1]?.classId ?? "",
    eventIds: orderedSessions.map((session) => session.eventId)
  };
};

const hasStructuralSessionChanges = (
  existingSessions: PAPSSession[],
  nextSessions: PAPSSession[]
): boolean => {
  if (existingSessions.length === 0) {
    return false;
  }

  const currentSnapshot = getSessionStructureSnapshot(existingSessions);
  const nextSnapshot = getSessionStructureSnapshot(nextSessions);

  return (
    currentSnapshot.sessionType !== nextSnapshot.sessionType ||
    currentSnapshot.classScope !== nextSnapshot.classScope ||
    currentSnapshot.primaryClassId !== nextSnapshot.primaryClassId ||
    currentSnapshot.secondaryClassId !== nextSnapshot.secondaryClassId ||
    currentSnapshot.eventIds.length !== nextSnapshot.eventIds.length ||
    currentSnapshot.eventIds.some((eventId, index) => eventId !== nextSnapshot.eventIds[index])
  );
};

const sessionHasRecordedAttempts = async (
  store: TeacherCrudStore,
  sessionId: string
): Promise<boolean> => {
  const records = await store.listSessionRecords(sessionId);

  return records.some((record) => record.attempts.length > 0);
};

const assertEditableSessionStructure = async ({
  store,
  existingSessions,
  nextSessions
}: {
  store: TeacherCrudStore;
  existingSessions: PAPSSession[];
  nextSessions: PAPSSession[];
}): Promise<void> => {
  if (
    existingSessions.length === 0 ||
    !hasStructuralSessionChanges(existingSessions, nextSessions)
  ) {
    return;
  }

  const hasRecordedAttempts = await Promise.all(
    existingSessions.map((session) => sessionHasRecordedAttempts(store, session.id))
  );

  if (hasRecordedAttempts.some(Boolean)) {
    throw new Error("이미 학생 기록이 있는 세션은 이름만 수정할 수 있습니다.");
  }
};

const toSessionSavePlan = async (
  body: Record<string, unknown>,
  context: AuthorizedTeacherRouteContext<TeacherCrudStore>
): Promise<{
  sessions: PAPSSession[];
  deletedSessionIds: string[];
  isEditing: boolean;
}> => {
  const { store, teacher } = context;
  const existingSessions = resolveExistingSessions(body, context);
  const firstExistingSession = existingSessions[0] ?? null;
  const sessionType = parseSessionType(body.sessionType);
  const classScope = body.classScope === "split" ? "split" : "single";
  const primaryClassId =
    typeof body.primaryClassId === "string" && body.primaryClassId.trim()
      ? body.primaryClassId.trim()
      : "";

  if (!primaryClassId) {
    throw new Error("A primary class is required.");
  }

  const primaryEventId = parseEventId(body.primaryEventId ?? body.eventId, "Primary event");
  const eventIds = parseEventIds(body.eventIds, primaryEventId);

  if (eventIds.length === 0) {
    throw new Error("At least one event is required.");
  }

  const primaryClass = await store.getClass(primaryClassId);
  const secondaryClassId =
    typeof body.secondaryClassId === "string" && body.secondaryClassId.trim()
      ? body.secondaryClassId.trim()
      : "";
  const createdAt =
    typeof body.createdAt === "string"
      ? body.createdAt
      : firstExistingSession?.createdAt ?? new Date().toISOString();
  const academicYear =
    Number(body.academicYear) ||
    firstExistingSession?.academicYear ||
    new Date(createdAt).getUTCFullYear();
  const schoolId =
    typeof body.schoolId === "string" && body.schoolId.trim()
      ? body.schoolId.trim()
      : teacher.schoolId;

  if (schoolId !== teacher.schoolId) {
    throw new Error("Forbidden");
  }

  if (
    typeof body.teacherId === "string" &&
    body.teacherId.trim() &&
    body.teacherId.trim() !== teacher.id
  ) {
    throw new Error("Forbidden");
  }

  if (existingSessions.some((session) => session.schoolId !== teacher.schoolId)) {
    throw new Error("Forbidden");
  }

  const defaultBaseName = `${primaryClass.label} ${primaryEventId}`;
  const baseName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : firstExistingSession?.sessionGroupName ??
        firstExistingSession?.name ??
        defaultBaseName;
  const nextSessionGroupId =
    eventIds.length > 1
      ? firstExistingSession?.sessionGroupId ??
        (existingSessions.length === 1 ? existingSessions[0]!.id : randomUUID())
      : null;
  const remainingReusableSessions = sortSessionsByGroupOrder(existingSessions);

  const nextSessions = await Promise.all(
    eventIds.map(async (eventId, index) => {
      const matchingSessionIndex = remainingReusableSessions.findIndex(
        (session) => session.eventId === eventId
      );
      const reusableSession =
        matchingSessionIndex >= 0
          ? remainingReusableSessions.splice(matchingSessionIndex, 1)[0] ?? null
          : index === 0
            ? remainingReusableSessions.shift() ?? null
            : null;
      const classTargets =
        classScope === "split"
          ? [
              { classId: primaryClassId, eventId },
              { classId: secondaryClassId, eventId }
            ]
          : [{ classId: primaryClassId, eventId }];

      for (const classTarget of classTargets) {
        if (!classTarget.classId) {
          throw new Error("A secondary class is required.");
        }

        if ((await store.getClass(classTarget.classId)).schoolId !== teacher.schoolId) {
          throw new Error("Forbidden");
        }
      }

      return validateSession({
        id: reusableSession?.id ?? randomUUID(),
        schoolId,
        teacherId: teacher.id,
        academicYear,
        name:
          nextSessionGroupId && eventIds.length > 1
            ? `${baseName} - ${getEventDefinition(eventId).label}`
            : baseName,
        gradeLevel: primaryClass.gradeLevel as GradeLevel,
        sessionType,
        classScope,
        eventId,
        classTargets,
        ...(nextSessionGroupId
          ? {
              sessionGroupId: nextSessionGroupId,
              sessionGroupName: baseName,
              sessionGroupOrder: index
            }
          : {}),
        isOpen:
          typeof body.isOpen === "boolean"
            ? body.isOpen
            : reusableSession?.isOpen ?? firstExistingSession?.isOpen ?? true,
        createdAt: reusableSession?.createdAt ?? firstExistingSession?.createdAt ?? createdAt
      });
    })
  );

  await assertEditableSessionStructure({
    store,
    existingSessions,
    nextSessions
  });

  return {
    sessions: nextSessions,
    deletedSessionIds: existingSessions
      .map((session) => session.id)
      .filter((sessionId) => !nextSessions.some((session) => session.id === sessionId)),
    isEditing: existingSessions.length > 0
  };
};

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  let teacher: PAPSTeacher;
  let bootstrap: AuthorizedTeacherRouteContext<TeacherCrudStore>["bootstrap"];

  try {
    ({ teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    }));
  } catch {
    return forbiddenTeacherRouteResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenTeacherRouteResponse();
  }

  const schoolId = teacher.schoolId;
  const sessions = bootstrap
    .sessions
    .filter((session) => !schoolId || session.schoolId === schoolId)
    .sort((left, right) => right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0);

  return NextResponse.json({
    sessions
  });
}

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const originClientId = request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER);
    const context = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const { store } = context;
    const savePlan = await toSessionSavePlan((body ?? {}) as Record<string, unknown>, context);
    const savedSessions =
      savePlan.sessions.length > 1
        ? await store.saveSessions(savePlan.sessions)
        : [await store.saveSession(savePlan.sessions[0]!)];

    for (const deletedSessionId of savePlan.deletedSessionIds) {
      await store.deleteSession(deletedSessionId);
    }

    const session = savedSessions[0]!;
    const sessionGroupId = session.sessionGroupId ?? null;
    const teacherStateVersion = buildTeacherStateVersion({
      ...context.bootstrap,
      sessions: [
        ...context.bootstrap.sessions.filter(
          (entry) =>
            !savePlan.deletedSessionIds.includes(entry.id) &&
            !savedSessions.some((savedSession) => savedSession.id === entry.id)
        ),
        ...savedSessions
      ]
    });
    const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;

    const response = NextResponse.json(
      {
        session,
        sessions: savedSessions,
        sessionGroupId,
        teacherStateVersion,
        studentSessionUrl:
          spreadsheetId && process.env.NODE_ENV === "production"
            ? sessionGroupId
              ? createStudentSessionGroupUrl({
                  sessionGroupId,
                  spreadsheetId
                })
              : createStudentSessionUrl({
                  sessionId: session.id,
                  spreadsheetId
                })
            : null
      },
      {
        status: savePlan.isEditing ? 200 : 201
      }
    );

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "session",
      originClientId
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    const message =
      error instanceof Error ? error.message : "Could not save the session.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: message.includes("was not found") ? 404 : 400
      }
    );
  }
}
