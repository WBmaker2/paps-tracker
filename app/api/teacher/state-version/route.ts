import { NextRequest, NextResponse } from "next/server";

import {
  classifyTeacherSheetStatus,
  createConnectedTeacherSheetStatus
} from "../../../../src/lib/google/sheet-connection-status";
import { readTeacherSheetVersion } from "../../../../src/lib/google/sheet-state-version";
import {
  createGoogleSheetClientFromEnv,
  PAPS_SPREADSHEET_ID_COOKIE
} from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const checkedAt = new Date().toISOString();

  if (!spreadsheetId) {
    const sheetStatus = classifyTeacherSheetStatus({ spreadsheetId });

    return NextResponse.json(
      {
        connected: false,
        version: null,
        checkedAt,
        reason: sheetStatus.code
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }

  try {
    const versionState = await readTeacherSheetVersion({
      client: createGoogleSheetClientFromEnv(),
      spreadsheetId,
      teacherEmail: teacherSession.session.email
    });
    const sheetStatus =
      versionState.connected
        ? createConnectedTeacherSheetStatus()
        : classifyTeacherSheetStatus({
            spreadsheetId,
            teacherAuthorized: false
          });

    return NextResponse.json(
      {
        connected: versionState.connected,
        version: versionState.version,
        checkedAt,
        reason: versionState.connected ? null : sheetStatus.code
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    const sheetStatus = classifyTeacherSheetStatus({
      spreadsheetId,
      error
    });

    return NextResponse.json(
      {
        connected: false,
        version: null,
        checkedAt,
        reason: sheetStatus.code
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  }
}
