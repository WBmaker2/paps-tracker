import { NextRequest, NextResponse } from "next/server";

import { validateGoogleSheetsUrl } from "../../../../src/lib/google/drive-link";
import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "../../../../src/lib/google/template";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);
  const result = validateGoogleSheetsUrl(typeof body?.url === "string" ? body.url : "");

  if (!result.ok) {
    return NextResponse.json(
      {
        ...result,
        prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
      },
      {
        status: 400
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      spreadsheetId: result.value.spreadsheetId,
      normalizedUrl: result.value.normalizedUrl,
      gid: result.value.gid,
      isCopyLink: result.value.isCopyLink,
      prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
    },
    {
      status: 200
    }
  );
}
