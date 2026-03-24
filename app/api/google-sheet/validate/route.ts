import { NextRequest, NextResponse } from "next/server";

import { validateGoogleSheetsUrl } from "../../../../src/lib/google/drive-link";
import { validatePapsGoogleSheetTemplate } from "../../../../src/lib/google/sheets-schema";
import {
  createGoogleSheetClientFromEnv,
  GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR
} from "../../../../src/lib/google/sheets-store";
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

  try {
    const client = createGoogleSheetClientFromEnv();
    const validation = await validatePapsGoogleSheetTemplate(client, result.value.spreadsheetId);

    return NextResponse.json(
      {
        ok: true,
        spreadsheetId: result.value.spreadsheetId,
        normalizedUrl: result.value.normalizedUrl,
        gid: result.value.gid,
        isCopyLink: result.value.isCopyLink,
        templateVersion: validation.templateVersion,
        prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
      },
      {
        status: 200
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR) {
      return NextResponse.json(
        {
          ok: true,
          spreadsheetId: result.value.spreadsheetId,
          normalizedUrl: result.value.normalizedUrl,
          gid: result.value.gid,
          isCopyLink: result.value.isCopyLink,
          templateVersion: null,
          prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
        },
        {
          status: 200
        }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Google Sheets validation failed.",
        prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
      },
      {
        status: 400
      }
    );
  }
}
