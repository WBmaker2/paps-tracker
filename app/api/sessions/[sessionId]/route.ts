import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../src/lib/google/sheets-store";
import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../../../src/lib/teacher-live-update-protocol";
import { publishTeacherLiveUpdate } from "../../../../src/lib/teacher-live-updates";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import type { AuthorizedTeacherRouteContext } from "../../../../src/lib/teacher-route-context";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../../src/lib/teacher-route-context";
import { buildTeacherStateVersion } from "../../../../src/lib/google/sheet-state-version";
import { isKnownEventId } from "../../../../src/lib/paps/catalog";
import { validateSession } from "../../../../src/lib/paps/validation";
import { hasRoundSessionStructureChange } from "../../../../src/lib/paps/assessment-round";
import type { EventId, GradeLevel, PAPSSession, SessionType } from "../../../../src/lib/paps/types";

const parseOptionalGradeLevel = (value: unknown, fallback: GradeLevel): GradeLevel => {
  if (value === undefined) {
    return fallback;
  }

  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("A valid grade level is required.");
};

const parseOptionalSessionType = (value: unknown, fallback: SessionType): SessionType => {
  if (value === undefined) {
    return fallback;
  }

  if (value === "official" || value === "practice") {
    return value;
  }

  throw new Error("A valid session type is required.");
};

const parseOptionalEventId = (
  value: unknown,
  fallback: EventId,
  fieldName: string
): EventId => {
  if (value === undefined) {
    return fallback;
  }

  if (isKnownEventId(value)) {
    return value;
  }

  throw new Error(`${fieldName} is invalid.`);
};

const getOwnedSession = (
  request: NextRequest,
  teacherEmail: string,
  sessionId: string
): Promise<{
  store: TeacherCrudStore;
  teacher: AuthorizedTeacherRouteContext<TeacherCrudStore>["teacher"];
  bootstrap: AuthorizedTeacherRouteContext<TeacherCrudStore>["bootstrap"];
  session: PAPSSession;
}> => {
  return getAuthorizedTeacherRouteContext({
    request,
    teacherEmail,
    createStore: createTeacherRuntimeStoreForRequest
  }).then(async (context) => {
    const { store, teacher, bootstrap } = context;
    const session = await store.getSession(sessionId);

    if (session.schoolId !== teacher.schoolId) {
      throw new Error("Forbidden");
    }

    return {
      store,
      teacher,
      bootstrap,
      session
    };
  });
};

const mergeSession = async (
  store: TeacherCrudStore,
  currentSession: PAPSSession,
  body: Record<string, unknown>
): Promise<PAPSSession> => {
  const classScope = body.classScope === "split" ? "split" : body.classScope === "single" ? "single" : currentSession.classScope;
  const primaryClassId =
    typeof body.primaryClassId === "string" && body.primaryClassId.trim()
      ? body.primaryClassId.trim()
      : currentSession.classTargets[0]?.classId ?? "";
  const primaryClass = await store.getClass(primaryClassId);
  const primaryEventId = parseOptionalEventId(
    body.primaryEventId ?? body.eventId,
    currentSession.classTargets[0]?.eventId ?? currentSession.eventId,
    "Primary event"
  );
  const secondaryClassId =
    typeof body.secondaryClassId === "string" && body.secondaryClassId.trim()
      ? body.secondaryClassId.trim()
      : currentSession.classTargets[1]?.classId ?? currentSession.classTargets[0]?.classId ?? "";

  return validateSession({
    ...currentSession,
    name:
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : currentSession.name,
    gradeLevel:
      classScope === "single"
        ? parseOptionalGradeLevel(body.gradeLevel, primaryClass.gradeLevel as GradeLevel)
        : (primaryClass.gradeLevel as GradeLevel),
    sessionType: parseOptionalSessionType(body.sessionType, currentSession.sessionType),
    classScope,
    eventId: primaryEventId,
    isOpen: typeof body.isOpen === "boolean" ? body.isOpen : currentSession.isOpen,
    classTargets:
      classScope === "split"
        ? [
            { classId: primaryClassId, eventId: primaryEventId },
            { classId: secondaryClassId, eventId: primaryEventId }
          ]
        : [{ classId: primaryClassId, eventId: primaryEventId }]
  });
};

type SessionRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(request: NextRequest, context: SessionRouteContext) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const { sessionId } = await context.params;

  try {
    const { session } = await getOwnedSession(request, teacherSession.session.email, sessionId);

    return NextResponse.json({
      session
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Session not found."
      },
      {
        status: 404
      }
    );
  }
}

export async function PATCH(request: NextRequest, context: SessionRouteContext) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);
  const { sessionId } = await context.params;

  try {
    const { store, teacher, bootstrap, session } = await getOwnedSession(
      request,
      teacherSession.session.email,
      sessionId
    );
    const bodyRecord = (body ?? {}) as Record<string, unknown>;

    if (
      typeof bodyRecord.primaryClassId === "string" &&
      (await store.getClass(bodyRecord.primaryClassId)).schoolId !== teacher.schoolId
    ) {
      return forbiddenTeacherRouteResponse();
    }

    if (
      typeof bodyRecord.secondaryClassId === "string" &&
      bodyRecord.secondaryClassId.trim() &&
      (await store.getClass(bodyRecord.secondaryClassId)).schoolId !== teacher.schoolId
    ) {
      return forbiddenTeacherRouteResponse();
    }

    const mergedSession = await mergeSession(store, session, bodyRecord);
    const structureChanged = hasRoundSessionStructureChange(session, mergedSession);
    if (session.assessmentRoundId && structureChanged) throw new Error("ROUND_SESSION_STRUCTURE_LOCKED");
    const updatedSession = await store.saveSession(mergedSession);
    const teacherStateVersion = buildTeacherStateVersion({
      ...bootstrap,
      sessions: bootstrap.sessions.map((entry) =>
        entry.id === updatedSession.id ? updatedSession : entry
      )
    });

    const response = NextResponse.json({
      session: updatedSession,
      teacherStateVersion
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "session",
      originClientId: request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER)
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the session.";

    if (message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      {
        error: message
      },
      {
        status: message.includes("was not found") ? 404 : message === "ROUND_SESSION_STRUCTURE_LOCKED" ? 409 : 400
      }
    );
  }
}

export async function DELETE(request: NextRequest, context: SessionRouteContext) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const { sessionId } = await context.params;

  try {
    const { store, teacher, bootstrap, session } = await getOwnedSession(
      request,
      teacherSession.session.email,
      sessionId
    );

    if (session.assessmentRoundId) {
      throw new Error("ROUND_SESSION_STRUCTURE_LOCKED");
    }

    await store.deleteSession(session.id);
    const teacherStateVersion = buildTeacherStateVersion({
      ...bootstrap,
      sessions: bootstrap.sessions.filter((entry) => entry.id !== session.id)
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "session",
      originClientId: request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER)
    });

    return NextResponse.json({ ok: true, teacherStateVersion });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the session.";

    if (message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      { error: message },
      {
        status: message.includes("was not found")
          ? 404
          : message === "ROUND_SESSION_STRUCTURE_LOCKED"
            ? 409
            : 400
      }
    );
  }
}
