import { NextRequest, NextResponse } from "next/server";

import { getTeacherSession } from "../../../../src/lib/teacher-auth";
import { isTeacherReturnPinEnabled, verifyTeacherReturnPin } from "../../../../src/lib/teacher-return";

const PIN_UNAVAILABLE_ERROR = "교사용 돌아가기 PIN이 아직 설정되지 않았습니다.";
const PIN_INVALID_ERROR = "교사용 PIN이 올바르지 않습니다.";

export async function POST(request: NextRequest) {
  if (!isTeacherReturnPinEnabled()) {
    return NextResponse.json({ error: PIN_UNAVAILABLE_ERROR }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        pin?: unknown;
      }
    | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!verifyTeacherReturnPin(pin)) {
    return NextResponse.json({ error: PIN_INVALID_ERROR }, { status: 401 });
  }

  const teacherSession = await getTeacherSession();

  return NextResponse.json({
    nextPath: teacherSession ? "/teacher" : "/auth/signin"
  });
}
