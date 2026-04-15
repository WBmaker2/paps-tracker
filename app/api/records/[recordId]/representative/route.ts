import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../../src/lib/google/sheets-store";
import { publishTeacherLiveUpdate } from "../../../../../src/lib/teacher-live-updates";
import { parseRecordId } from "../../../../../src/lib/paps/record-id";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../../../src/lib/teacher-route-context";

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
    const { store, teacher } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const selector = parseRecordId(recordId);
    const session = await store.getSession(selector.sessionId);
    const student = await store.getStudent(selector.studentId);

    if (session.schoolId !== teacher.schoolId || student.schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    if (body?.intent === "requeue-sync") {
      const currentSyncStatus = await store.getSyncStatus(selector);
      const syncStatus = await store.setSyncStatus({
        ...selector,
        status: "pending",
        attemptId: currentSyncStatus?.attemptId ?? null,
        updatedAt: new Date().toISOString()
      });

      const response = NextResponse.json({
        syncStatus
      });

      publishTeacherLiveUpdate({
        teacherEmail: teacherSession.session.email,
        source: "record"
      });

      return response;
    }

    const record = await store.selectRepresentativeAttempt({
      ...selector,
      attemptId: typeof body?.attemptId === "string" || body?.attemptId === null ? body.attemptId : null,
      changedByTeacherId: teacher.id,
      createdAt: new Date().toISOString(),
      reason: typeof body?.reason === "string" ? body.reason : undefined
    });

    const response = NextResponse.json({
      record
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "record"
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not update the representative attempt.";

    if (message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
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
