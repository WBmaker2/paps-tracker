import { NextRequest, NextResponse } from "next/server";

import { rebuildGoogleSheetSummaries } from "../../../../src/lib/google/sheets-rebuild";
import {
  createTeacherRuntimeStoreForRequest,
  PAPS_SPREADSHEET_ID_COOKIE
} from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../../src/lib/teacher-route-context";
import { publishTeacherLiveUpdate } from "../../../../src/lib/teacher-live-updates";

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

    await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });

    const result = await rebuildGoogleSheetSummaries({
      spreadsheetId,
      teacherEmail: teacherSession.session.email
    });

    if (!result.ok) {
      return NextResponse.json(result, {
        status: result.status
      });
    }

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "summary"
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "요약 재계산을 준비하지 못했습니다.";

    if (message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
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
