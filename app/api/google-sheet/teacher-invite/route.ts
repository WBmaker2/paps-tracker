import { NextRequest, NextResponse } from "next/server";

import { isTeacherEmailAllowed } from "../../../../src/lib/env";
import {
  createTeacherRuntimeStoreForRequest,
  PAPS_SPREADSHEET_ID_COOKIE,
  type TeacherCrudStore
} from "../../../../src/lib/google/sheets-store";
import {
  createTeacherSheetInviteToken,
  TEACHER_SHEET_INVITE_TTL_MS
} from "../../../../src/lib/google/teacher-sheet-invite";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import { getAuthorizedTeacherRouteContext } from "../../../../src/lib/teacher-route-context";

const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value?.trim() ?? "";
  const body = await request.json().catch(() => null);
  const targetEmail = normalizeEmail(body?.targetEmail);

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "먼저 승인할 교사가 연결된 구글 시트를 열어주세요." },
      { status: 400 }
    );
  }

  if (!targetEmail) {
    return NextResponse.json({ error: "추가할 교사 이메일을 입력해주세요." }, { status: 400 });
  }

  if (!isTeacherEmailAllowed(targetEmail)) {
    return NextResponse.json(
      { error: "초대할 교사 이메일이 로그인 허용 범위에 없습니다." },
      { status: 403 }
    );
  }

  try {
    const { bootstrap } = await getAuthorizedTeacherRouteContext<TeacherCrudStore>({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });

    if (
      bootstrap.teachers.some(
        (teacher) => teacher.email.trim().toLowerCase() === targetEmail
      )
    ) {
      return NextResponse.json(
        { error: "이미 이 시트의 담당교사로 등록된 이메일입니다." },
        { status: 409 }
      );
    }

    const now = new Date();
    const inviteToken = createTeacherSheetInviteToken({
      spreadsheetId,
      inviterEmail: teacherSession.session.email,
      targetEmail,
      now
    });

    return NextResponse.json(
      {
        inviteToken,
        targetEmail,
        expiresAt: new Date(now.getTime() + TEACHER_SHEET_INVITE_TTL_MS).toISOString(),
        expiresInSeconds: TEACHER_SHEET_INVITE_TTL_MS / 1000
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "현재 교사는 이 시트의 교사 추가를 승인할 수 없습니다." },
      { status: 403 }
    );
  }
}
