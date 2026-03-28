import { NextRequest, NextResponse } from "next/server";

import { createPapsGoogleSheetTabPayloads } from "../../../../src/lib/google/sheets";
import {
  loadTeacherPageState,
  PAPS_SPREADSHEET_ID_COOKIE
} from "../../../../src/lib/google/sheets-store";
import { buildSummaryWorkbook } from "../../../../src/lib/google/summary-export-xlsx";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;

  try {
    if (!spreadsheetId) {
      throw new Error("Google Sheets is not connected.");
    }

    const { bootstrap, sheetConnected } = await loadTeacherPageState({
      teacherEmail: teacherSession.session.email,
      spreadsheetId
    });
    const schoolId = bootstrap.teacher?.schoolId ?? null;
    const school = schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;

    if (!sheetConnected || !school) {
      throw new Error("Google Sheets is not connected.");
    }

    const sessionIds = new Set(bootstrap.sessions.map((entry) => entry.id));
    const tabs = createPapsGoogleSheetTabPayloads({
      school,
      classes: bootstrap.classes,
      teachers: schoolId
        ? bootstrap.teachers.filter((entry) => entry.schoolId === schoolId)
        : bootstrap.teachers,
      students: bootstrap.students,
      sessions: bootstrap.sessions,
      attempts: bootstrap.attempts.filter((entry) => sessionIds.has(entry.sessionId)),
      syncStatuses: bootstrap.syncStatuses,
      syncErrorLogs: bootstrap.syncErrorLogs,
      representativeSelectionAuditLogs: bootstrap.representativeSelectionAuditLogs
    });
    const workbook = buildSummaryWorkbook(tabs);

    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        "content-type": XLSX_CONTENT_TYPE,
        "content-disposition": 'attachment; filename="summary-export.xlsx"',
        "cache-control": "no-store"
      }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요약 XLSX를 준비하지 못했습니다.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: message === "Google Sheets is not connected." ? 409 : 400
      }
    );
  }
}
