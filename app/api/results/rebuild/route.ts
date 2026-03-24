import { NextRequest, NextResponse } from "next/server";

import { rebuildGoogleSheetSummaries } from "../../../../src/lib/google/sheets-rebuild";
import {
  createTeacherRuntimeStoreForRequest,
  PAPS_SPREADSHEET_ID_COOKIE
} from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

const forbiddenResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
    }
  );

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;

  try {
    if (!spreadsheetId) {
      throw new Error("Google Sheets is not connected.");
    }

    const store = await createTeacherRuntimeStoreForRequest(request, teacherSession.session.email);
    const bootstrap = await store.getTeacherBootstrap({
      teacherEmail: teacherSession.session.email
    });

    if (!bootstrap.teacher?.schoolId) {
      return forbiddenResponse();
    }

    const result = await rebuildGoogleSheetSummaries({
      spreadsheetId,
      teacherEmail: teacherSession.session.email
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.status
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요약 재계산을 준비하지 못했습니다.";

    if (message === "Forbidden") {
      return forbiddenResponse();
    }

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
