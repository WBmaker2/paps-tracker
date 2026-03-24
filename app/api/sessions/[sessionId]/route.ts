import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import type { EventId, GradeLevel, PAPSSession, PAPSTeacher, SessionType } from "../../../../src/lib/paps/types";

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

  if (value === "sit-and-reach" || value === "shuttle-run" || value === "long-run-walk") {
    return value;
  }

  throw new Error(`${fieldName} is invalid.`);
};

const forbiddenResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
    }
  );

const getAuthorizedTeacherContext = async (request: NextRequest, teacherEmail: string): Promise<{
  store: TeacherCrudStore;
  teacher: PAPSTeacher;
}> => {
  const store = await createTeacherRuntimeStoreForRequest(request, teacherEmail);
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail });
  const teacher = bootstrap.teacher;

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher
  };
};

const getOwnedSession = (
  request: NextRequest,
  teacherEmail: string,
  sessionId: string
): Promise<{
  store: TeacherCrudStore;
  teacher: PAPSTeacher;
  session: PAPSSession;
}> => {
  return getAuthorizedTeacherContext(request, teacherEmail).then(async (context) => {
    const { store, teacher } = context;
    const session = await store.getSession(sessionId);

    if (session.schoolId !== teacher.schoolId) {
      throw new Error("Forbidden");
    }

    return {
      store,
      teacher,
      session
    };
  });
};

const mergeSession = (currentSession: PAPSSession, body: Record<string, unknown>): PAPSSession => {
  const classScope = body.classScope === "split" ? "split" : body.classScope === "single" ? "single" : currentSession.classScope;
  const primaryClassId =
    typeof body.primaryClassId === "string" && body.primaryClassId.trim()
      ? body.primaryClassId.trim()
      : currentSession.classTargets[0]?.classId ?? "";
  const primaryEventId = parseOptionalEventId(
    body.primaryEventId ?? body.eventId,
    currentSession.classTargets[0]?.eventId ?? currentSession.eventId,
    "Primary event"
  );
  const secondaryClassId =
    typeof body.secondaryClassId === "string" && body.secondaryClassId.trim()
      ? body.secondaryClassId.trim()
      : currentSession.classTargets[1]?.classId ?? currentSession.classTargets[0]?.classId ?? "";
  const secondaryEventId = parseOptionalEventId(
    body.secondaryEventId,
    currentSession.classTargets[1]?.eventId ?? primaryEventId,
    "Secondary event"
  );

  return {
    ...currentSession,
    name:
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : currentSession.name,
    gradeLevel: parseOptionalGradeLevel(body.gradeLevel, currentSession.gradeLevel),
    sessionType: parseOptionalSessionType(body.sessionType, currentSession.sessionType),
    classScope,
    eventId: primaryEventId,
    isOpen: typeof body.isOpen === "boolean" ? body.isOpen : currentSession.isOpen,
    classTargets:
      classScope === "split"
        ? [
            { classId: primaryClassId, eventId: primaryEventId },
            { classId: secondaryClassId, eventId: secondaryEventId }
          ]
        : [{ classId: primaryClassId, eventId: primaryEventId }]
  };
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
      return forbiddenResponse();
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
    const { store, teacher, session } = await getOwnedSession(request, teacherSession.session.email, sessionId);
    const bodyRecord = (body ?? {}) as Record<string, unknown>;

    if (
      typeof bodyRecord.primaryClassId === "string" &&
      (await store.getClass(bodyRecord.primaryClassId)).schoolId !== teacher.schoolId
    ) {
      return forbiddenResponse();
    }

    if (
      typeof bodyRecord.secondaryClassId === "string" &&
      bodyRecord.secondaryClassId.trim() &&
      (await store.getClass(bodyRecord.secondaryClassId)).schoolId !== teacher.schoolId
    ) {
      return forbiddenResponse();
    }

    const updatedSession = await store.saveSession(
      mergeSession(session, bodyRecord)
    );

    return NextResponse.json({
      session: updatedSession
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the session.";

    if (message === "Forbidden") {
      return forbiddenResponse();
    }

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
