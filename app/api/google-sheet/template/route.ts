import { NextRequest, NextResponse } from "next/server";

import { resolveGoogleSheetsTemplateLink } from "../../../../src/lib/google/template";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const template = resolveGoogleSheetsTemplateLink({
      templateId: typeof body?.templateId === "string" ? body.templateId : undefined,
      templateUrl: typeof body?.templateUrl === "string" ? body.templateUrl : undefined
    });

    return NextResponse.json({
      ok: true,
      template
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Template configuration is invalid."
      },
      { status: 400 }
    );
  }
}
