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

const toSessionInputs = async (
  body: Record<string, unknown>,
  context: AuthorizedTeacherRouteContext<TeacherCrudStore>
): Promise<PAPSSession[]> => {
  const { store, teacher, bootstrap } = context;
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
  const timestamp = typeof body.createdAt === "string" ? body.createdAt : new Date().toISOString();
  const academicYear = Number(body.academicYear) || new Date(timestamp).getUTCFullYear();
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

  const existingSessionId =
    typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  const existingSession = existingSessionId
    ? bootstrap.sessions.find((session) => session.id === existingSessionId) ?? null
    : null;

  if (existingSession && existingSession.schoolId !== teacher.schoolId) {
    throw new Error("Forbidden");
  }

  if (existingSessionId && eventIds.length > 1) {
    throw new Error("Existing sessions can only be updated one event at a time.");
  }

  const baseName =
    typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `${primaryClass.label} ${primaryEventId}`;
  const sessionGroupId = eventIds.length > 1 ? randomUUID() : null;

  return Promise.all(
    eventIds.map(async (eventId, index) => {
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
        id: existingSessionId ?? randomUUID(),
        schoolId,
        teacherId: teacher.id,
        academicYear,
        name:
          sessionGroupId && eventIds.length > 1
            ? `${baseName} - ${getEventDefinition(eventId).label}`
            : baseName,
        gradeLevel: primaryClass.gradeLevel as GradeLevel,
        sessionType,
        classScope,
        eventId,
        classTargets,
        ...(sessionGroupId
          ? {
              sessionGroupId,
              sessionGroupName: baseName,
              sessionGroupOrder: index
            }
          : {}),
        isOpen: body.isOpen !== false,
        createdAt: timestamp
      });
    })
  );
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
    const sessionInputs = await toSessionInputs((body ?? {}) as Record<string, unknown>, context);
    const sessions =
      sessionInputs.length > 1
        ? await store.saveSessions(sessionInputs)
        : [await store.saveSession(sessionInputs[0]!)];
    const session = sessions[0]!;
    const sessionGroupId = session.sessionGroupId ?? null;
    const teacherStateVersion = buildTeacherStateVersion({
      ...context.bootstrap,
      sessions: [
        ...context.bootstrap.sessions.filter(
          (entry) => !sessions.some((savedSession) => savedSession.id === entry.id)
        ),
        ...sessions
      ]
    });
    const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;

    const response = NextResponse.json(
      {
        session,
        sessions,
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
        status: 201
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

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save the session."
      },
      {
        status: 400
      }
    );
  }
}
