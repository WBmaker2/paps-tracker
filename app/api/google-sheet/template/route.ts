import { NextRequest, NextResponse } from "next/server";

import { getGoogleSheetsEnv } from "../../../../src/lib/env";
import { resolveGoogleSheetsTemplateLink } from "../../../../src/lib/google/template";
import { createGoogleSheetClientFromEnv } from "../../../../src/lib/google/sheet-store-factory";
import { GoogleSheetsAccessError, GoogleSheetsApiDisabledError } from "../../../../src/lib/google/sheets-client";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const env = getGoogleSheetsEnv();
    const template = resolveGoogleSheetsTemplateLink({
      templateId: typeof body?.templateId === "string" ? body.templateId : undefined,
      templateUrl: typeof body?.templateUrl === "string" ? body.templateUrl : undefined
    });

    // A configured ID does not prove the remote template still exists or is
    // visible to this service account. Check metadata before offering its copy URL.
    const sheetsClient = createGoogleSheetClientFromEnv();
    await sheetsClient.getSpreadsheet(template.templateSpreadsheetId);

    return NextResponse.json({
      ok: true,
      template,
      serviceAccountEmail: env.serviceAccountEmail,
      templateAccessible: true
    });
  } catch (error) {
    if (error instanceof GoogleSheetsAccessError) {
      return NextResponse.json(
        {
          ok: false,
          code: "template_unavailable",
          error: "템플릿 파일을 서비스 계정에서 열 수 없습니다. 파일이 삭제되었거나 공유 권한이 없을 수 있습니다. 관리자에게 유효한 GOOGLE_SHEETS_TEMPLATE_ID와 템플릿 공유 권한을 확인해 달라고 요청하거나, 이미 사용하는 시트 URL을 아래에 입력해 주세요."
        },
        { status: 400 }
      );
    }

    if (error instanceof GoogleSheetsApiDisabledError) {
      return NextResponse.json(
        {
          ok: false,
          code: "sheets_api_disabled",
          error: "Google Sheets API를 사용할 수 없습니다. 관리자에게 API 사용 설정을 확인해 달라고 요청하거나, 이미 사용하는 시트 URL을 아래에 입력해 주세요."
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "template_check_failed",
        error: "템플릿 접근을 확인하지 못했습니다. 서비스 계정과 Sheets API 설정을 확인하거나, 이미 사용하는 시트 URL을 아래에 입력해 주세요."
      },
      { status: 400 }
    );
  }
}
