import { NextRequest, NextResponse } from "next/server";

import { parseRecordId } from "../../../../../src/lib/demo-store";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../../../src/lib/store/paps-store";
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

const getAuthorizedTeacherContext = async (teacherEmail: string): Promise<{
  store: Awaited<ReturnType<typeof createStoreForRequest>>;
  teacher: PAPSTeacher;
}> => {
  const store = await createStoreForRequest();
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail });
  const teacher = bootstrap.teacher;

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher: teacher as PAPSTeacher
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
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);
    const syncStore = store as Awaited<ReturnType<typeof createStoreForRequest>> & {
      getSyncStatus(selector: { sessionId: string; studentId: string }): {
        attemptId: string | null;
      } | null;
      setSyncStatus(input: {
        sessionId: string;
        studentId: string;
        status: "pending" | "synced" | "failed";
        attemptId: string | null;
        updatedAt: string;
      }): {
        id: string;
        sessionId: string;
        studentId: string;
        status: "pending" | "synced" | "failed";
        attemptId: string | null;
        updatedAt: string;
      };
    };
    const selector = parseRecordId(recordId);
    const session = syncStore.getSession(selector.sessionId);
    const student = syncStore.getStudent(selector.studentId);

    if (session.schoolId !== teacher.schoolId || student.schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    if (body?.intent === "requeue-sync") {
      const currentSyncStatus = syncStore.getSyncStatus(selector);
      const syncStatus = syncStore.setSyncStatus({
        ...selector,
        status: "pending",
        attemptId: currentSyncStatus?.attemptId ?? null,
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        syncStatus
      });
    }

    const record = syncStore.selectRepresentativeAttempt({
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
