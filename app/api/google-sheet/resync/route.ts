import { NextRequest, NextResponse } from "next/server";

import { getDemoStore } from "../../../../src/lib/demo-store";
import { parseGoogleSheetsUrl } from "../../../../src/lib/google/drive-link";
import { resyncGoogleSheet, type GoogleSheetResyncInput } from "../../../../src/lib/google/resync";
import {
  assertGoogleSheetTabsMatchPrototype,
  createPapsGoogleSheetTabPayloads,
  parseGoogleSheetTabPayloads
} from "../../../../src/lib/google/sheets";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const store = getDemoStore();
    const teacher = store.getTeacherByEmail(teacherSession.session.email);
    const spreadsheetId =
      typeof body?.spreadsheetId === "string" && body.spreadsheetId.trim()
        ? body.spreadsheetId.trim()
        : parseGoogleSheetsUrl(typeof body?.spreadsheetUrl === "string" ? body.spreadsheetUrl : "")
            .spreadsheetId;
    const school = teacher?.schoolId
      ? store.getSchool(teacher.schoolId)
      : store.listSchools()[0] ?? null;

    if (!school) {
      throw new Error("Could not find a school to export.");
    }

    const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);
    const classIds = new Set(classes.map((entry) => entry.id));
    const teachers = store.listTeachers().filter((entry) => entry.schoolId === school.id);
    const students = store
      .listStudents()
      .filter((entry) => entry.schoolId === school.id || classIds.has(entry.classId));
    const sessions = store.listSessions().filter((entry) => entry.schoolId === school.id);
    const sessionIds = new Set(sessions.map((entry) => entry.id));
    const attempts = sessions.flatMap((session) =>
      store.listSessionRecords(session.id).flatMap((record) =>
        record.attempts.map((attempt) => ({
          id: attempt.id,
          sessionId: record.sessionId,
          studentId: record.studentId,
          eventId: record.eventId,
          unit: record.unit,
          attemptNumber: attempt.attemptNumber,
          measurement: attempt.measurement,
          createdAt: attempt.createdAt
        }))
      )
    );
    const syncStatuses = store
      .listSyncStatuses()
      .filter((entry) => sessionIds.has(entry.sessionId));
    const syncErrorLogs = store
      .listSyncErrorLogs()
      .filter((entry) => sessionIds.has(entry.sessionId));
    const representativeSelectionAuditLogs = store
      .listRepresentativeSelectionAuditLogs()
      .filter((entry) => sessionIds.has(entry.sessionId));
    const input: GoogleSheetResyncInput = {
      spreadsheetId,
      tabs: Array.isArray(body?.tabs)
        ? assertGoogleSheetTabsMatchPrototype(parseGoogleSheetTabPayloads(body?.tabs))
        : createPapsGoogleSheetTabPayloads({
            school,
            classes,
            teachers,
            students,
            sessions,
            attempts,
            syncStatuses,
            syncErrorLogs,
            representativeSelectionAuditLogs
          }),
      triggeredByTeacherEmail: teacherSession.session.email,
      source: body?.source === "file-store" ? "file-store" : "manual",
      dryRun: body?.dryRun !== false
    };
    const result = await resyncGoogleSheet(input);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not prepare the resync request."
      },
      { status: 400 }
    );
  }
}
