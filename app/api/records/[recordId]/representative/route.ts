import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../../../src/lib/google/sheets-store";
import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../../../../src/lib/teacher-live-update-protocol";
import { publishTeacherLiveUpdate } from "../../../../../src/lib/teacher-live-updates";
import { parseRecordId } from "../../../../../src/lib/paps/record-id";
import { requireTeacherRouteSession } from "../../../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../../../src/lib/teacher-route-context";
import { buildTeacherStateVersion } from "../../../../../src/lib/google/sheet-state-version";

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
    const originClientId = request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER);
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
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
      const updatedAt = new Date().toISOString();
      const syncStatus = await store.setSyncStatus({
        ...selector,
        status: "pending",
        attemptId: currentSyncStatus?.attemptId ?? null,
        updatedAt
      });
      const teacherStateVersion = buildTeacherStateVersion({
        ...bootstrap,
        syncStatuses: [...bootstrap.syncStatuses.filter((entry) => entry.id !== syncStatus.id), syncStatus]
      });

      const response = NextResponse.json({
        syncStatus,
        teacherStateVersion
      });

      publishTeacherLiveUpdate({
        teacherEmail: teacherSession.session.email,
        source: "record",
        originClientId
      });

      return response;
    }

    const createdAt = new Date().toISOString();
    const previousAttemptId =
      bootstrap.representativeSelectionAuditLogs
        .filter(
          (entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1)?.selectedAttemptId ?? null;
    const record = await store.selectRepresentativeAttempt({
      ...selector,
      attemptId: typeof body?.attemptId === "string" || body?.attemptId === null ? body.attemptId : null,
      changedByTeacherId: teacher.id,
      createdAt,
      reason: typeof body?.reason === "string" ? body.reason : undefined
    });
    const teacherStateVersion = buildTeacherStateVersion({
      ...bootstrap,
      representativeSelectionAuditLogs: [
        ...bootstrap.representativeSelectionAuditLogs,
        {
          id: `rep:${selector.sessionId}:${selector.studentId}:${createdAt}`,
          sessionId: selector.sessionId,
          studentId: selector.studentId,
          eventId: session.eventId,
          previousAttemptId,
          selectedAttemptId: record.representativeAttemptId,
          changedByTeacherId: teacher.id,
          reason: typeof body?.reason === "string" ? body.reason : undefined,
          createdAt
        }
      ]
    });

    const response = NextResponse.json({
      record,
      teacherStateVersion
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "record",
      originClientId
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
