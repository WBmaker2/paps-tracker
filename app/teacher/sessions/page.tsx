import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../../src/components/teacher/session-form";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherSessionsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });

  return (
    <AppShell
      eyebrow="Sessions"
      title="세션 운영"
      description="새 세션을 만들고, 진행 중 세션을 열기와 닫기로 제어합니다."
    >
      <TeacherSessionWorkspace
        classes={bootstrap.classes}
        sessions={bootstrap.sessions}
        defaultTeacherId={bootstrap.teacher?.id}
        defaultSchoolId={bootstrap.teacher?.schoolId}
        showRecentSessions={false}
        sheetConnected={sheetConnected}
      />
    </AppShell>
  );
}
