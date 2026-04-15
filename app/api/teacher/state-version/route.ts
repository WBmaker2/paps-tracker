import { NextRequest, NextResponse } from "next/server";

import { buildTeacherStateVersion } from "../../../../src/lib/google/sheet-state-version";
import {
  loadTeacherPageState,
  PAPS_SPREADSHEET_ID_COOKIE
} from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected, sheetStatus } = await loadTeacherPageState({
    teacherEmail: teacherSession.session.email,
    spreadsheetId
  });
  const connected = sheetConnected && Boolean(bootstrap.teacher);

  return NextResponse.json(
    {
      connected,
      version: connected ? buildTeacherStateVersion(bootstrap) : null,
      checkedAt: new Date().toISOString(),
      reason: connected ? null : sheetStatus.code
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
