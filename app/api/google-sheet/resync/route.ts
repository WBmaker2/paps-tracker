import { NextRequest, NextResponse } from "next/server";

import { parseGoogleSheetsUrl } from "../../../../src/lib/google/drive-link";
import { resyncGoogleSheet, type GoogleSheetResyncInput } from "../../../../src/lib/google/resync";
import { createTeacherRuntimeStoreForRequest } from "../../../../src/lib/google/sheets-store";
import {
  assertGoogleSheetTabsMatchPrototype,
  createPapsGoogleSheetTabPayloads,
  parseGoogleSheetTabPayloads
} from "../../../../src/lib/google/sheets";
import type { PAPSStoredAttempt } from "../../../../src/lib/paps/types";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

const toStoredAttempts = (
  records: Array<{
    sessionId: string;
    studentId: string;
    eventId: PAPSStoredAttempt["eventId"];
    unit: PAPSStoredAttempt["unit"];
    attempts: Array<{
      id: string;
      attemptNumber: number;
      measurement: number;
      createdAt: string;
      clientSubmissionKey?: string;
    }>;
  }>
): PAPSStoredAttempt[] =>
  records.flatMap((record) =>
    record.attempts.map((attempt) => ({
      id: attempt.id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      eventId: record.eventId,
      unit: record.unit,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey
    }))
  );

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const store = await createTeacherRuntimeStoreForRequest(request, teacherSession.session.email);
    const bootstrap = await store.getTeacherBootstrap({
      teacherEmail: teacherSession.session.email
    });
    const teacher = bootstrap.teacher;
    const spreadsheetId =
      typeof body?.spreadsheetId === "string" && body.spreadsheetId.trim()
        ? body.spreadsheetId.trim()
        : parseGoogleSheetsUrl(typeof body?.spreadsheetUrl === "string" ? body.spreadsheetUrl : "")
            .spreadsheetId;
    const school = teacher?.schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;

    if (!school) {
      throw new Error("Could not find a school to export.");
    }

    const classes = bootstrap.classes.filter((entry) => entry.schoolId === school.id);
    const classIds = new Set(classes.map((entry) => entry.id));
    const teachers = bootstrap.teachers.filter((entry) => entry.schoolId === school.id);
    const students = bootstrap.students
      .filter((entry) => entry.schoolId === school.id || classIds.has(entry.classId));
    const sessions = bootstrap.sessions.filter((entry) => entry.schoolId === school.id);
    const sessionIds = new Set(sessions.map((entry) => entry.id));
    const attempts = toStoredAttempts(
      (
        await Promise.all(
          sessions.map(async (session) => await store.listSessionRecords(session.id))
        )
      ).flat()
    );
    const syncStatuses = bootstrap.syncStatuses.filter((entry) => sessionIds.has(entry.sessionId));
    const syncErrorLogs = bootstrap.syncErrorLogs.filter((entry) => sessionIds.has(entry.sessionId));
    const representativeSelectionAuditLogs = bootstrap.representativeSelectionAuditLogs.filter((entry) =>
      sessionIds.has(entry.sessionId)
    );
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
