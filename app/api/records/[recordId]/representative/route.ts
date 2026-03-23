import { NextRequest, NextResponse } from "next/server";

import { getDemoStore, parseRecordId } from "../../../../../src/lib/demo-store";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import type { PAPSTeacher } from "../../../../../src/lib/paps/types";

const forbiddenResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
    }
  );

const getAuthorizedTeacherContext = (teacherEmail: string): {
  store: ReturnType<typeof getDemoStore>;
  teacher: PAPSTeacher;
} => {
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherEmail);

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher
  };
};

type RepresentativeRouteContext = {
  params: Promise<{
    recordId: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RepresentativeRouteContext) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);
  const { recordId } = await context.params;

  try {
    const { store, teacher } = getAuthorizedTeacherContext(teacherSession.session.email);
    const selector = parseRecordId(recordId);
    const session = store.getSession(selector.sessionId);
    const student = store.getStudent(selector.studentId);

    if (session.schoolId !== teacher.schoolId || student.schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    if (body?.intent === "requeue-sync") {
      const currentSyncStatus = store.getSyncStatus(selector);
      const syncStatus = store.setSyncStatus({
        ...selector,
        status: "pending",
        attemptId: currentSyncStatus?.attemptId ?? null,
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        syncStatus
      });
    }

    const record = store.selectRepresentativeAttempt({
      ...selector,
      attemptId: typeof body?.attemptId === "string" || body?.attemptId === null ? body.attemptId : null,
      changedByTeacherId: teacher.id,
      createdAt: new Date().toISOString(),
      reason: typeof body?.reason === "string" ? body.reason : undefined
    });

    return NextResponse.json({
      record
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the representative attempt.";

    if (message === "Forbidden") {
      return forbiddenResponse();
    }

    return NextResponse.json(
      {
        error: message
      },
      {
        status: message.includes("invalid") || message.includes("was not found") ? 404 : 400
      }
    );
  }
}
