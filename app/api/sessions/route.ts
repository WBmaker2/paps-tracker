import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";
import type { TeacherBootstrap } from "../../../src/lib/store/paps-store-types";
import type { EventId, GradeLevel, PAPSSession, PAPSTeacher, SessionType } from "../../../src/lib/paps/types";

const parseGradeLevel = (value: unknown): GradeLevel => {
  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("A valid grade level is required.");
};

const parseSessionType = (value: unknown): SessionType => {
  if (value === "official" || value === "practice") {
    return value;
  }

  throw new Error("A valid session type is required.");
};

const parseEventId = (value: unknown, fieldName: string): EventId => {
  if (value === "sit-and-reach" || value === "shuttle-run" || value === "long-run-walk") {
    return value;
  }

  throw new Error(`${fieldName} is required.`);
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

const getAuthorizedTeacherContext = async (teacherEmail: string): Promise<{
  store: Awaited<ReturnType<typeof createStoreForRequest>>;
  teacher: PAPSTeacher;
  bootstrap: TeacherBootstrap;
}> => {
  const store = await createStoreForRequest();
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail });
  const teacher = bootstrap.teacher;

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher: teacher as PAPSTeacher,
    bootstrap
  };
};

const toSessionInput = async (body: Record<string, unknown>, teacherEmail: string): Promise<PAPSSession> => {
  const { store, teacher, bootstrap } = await getAuthorizedTeacherContext(teacherEmail);
  const gradeLevel = parseGradeLevel(body.gradeLevel);
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
  const secondaryClassId =
    typeof body.secondaryClassId === "string" && body.secondaryClassId.trim()
      ? body.secondaryClassId.trim()
      : "";
  const secondaryEventId =
    classScope === "split"
      ? parseEventId(body.secondaryEventId ?? body.eventId, "Secondary event")
      : primaryEventId;
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

  const classTargets =
    classScope === "split"
      ? [
          { classId: primaryClassId, eventId: primaryEventId },
          { classId: secondaryClassId, eventId: secondaryEventId }
        ]
      : [{ classId: primaryClassId, eventId: primaryEventId }];

  for (const classTarget of classTargets) {
    if (!classTarget.classId) {
      throw new Error("A secondary class is required.");
    }

    if (store.getClass(classTarget.classId).schoolId !== teacher.schoolId) {
      throw new Error("Forbidden");
    }
  }

  return {
    id: existingSessionId ?? randomUUID(),
    schoolId,
    teacherId: teacher.id,
    academicYear,
    name:
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : `${gradeLevel}학년 ${primaryEventId}`,
    gradeLevel,
    sessionType,
    classScope,
    eventId: primaryEventId,
    classTargets,
    isOpen: body.isOpen !== false,
    createdAt: timestamp
  };
};

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  let store: Awaited<ReturnType<typeof createStoreForRequest>>;
  let teacher: PAPSTeacher;

  try {
    ({ store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email));
  } catch {
    return forbiddenResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenResponse();
  }

  const schoolId = teacher.schoolId;
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.session.email });
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
    const { store } = await getAuthorizedTeacherContext(teacherSession.session.email);
    const session = store.saveSession(
      await toSessionInput((body ?? {}) as Record<string, unknown>, teacherSession.session.email)
    );

    return NextResponse.json(
      {
        session
      },
      {
        status: 201
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
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
