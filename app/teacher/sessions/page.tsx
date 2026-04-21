import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherDataRefresh } from "../../../src/components/teacher/teacher-data-refresh";
import { TeacherSessionWorkspace } from "../../../src/components/teacher/session-form";
import { buildTeacherStateVersion } from "../../../src/lib/google/sheet-state-version";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import {
  createStudentSessionGroupUrl,
  createStudentSessionUrl
} from "../../../src/lib/student-session-access";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherSessionsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected, sheetStatus } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });
  const initialVersion =
    sheetConnected && bootstrap.teacher ? buildTeacherStateVersion(bootstrap) : null;
  const studentSessionUrls =
    spreadsheetId && sheetConnected
      ? Object.fromEntries(
          bootstrap.sessions.map((session) => {
            const key = session.sessionGroupId ?? session.id;

            return [
              key,
              session.sessionGroupId
                ? createStudentSessionGroupUrl({
                    sessionGroupId: session.sessionGroupId,
                    spreadsheetId
                  })
                : createStudentSessionUrl({
                    sessionId: session.id,
                    spreadsheetId
                  })
            ];
          })
        )
      : {};

  return (
    <AppShell
      eyebrow="Sessions"
      title="세션 운영"
      description="새 세션을 만들고, 진행 중 세션을 열기와 닫기로 제어합니다."
    >
      <TeacherDataRefresh initialVersion={initialVersion} pollIntervalMs={45000} />
      <TeacherSessionWorkspace
        classes={bootstrap.classes}
        sessions={bootstrap.sessions}
        studentSessionUrls={studentSessionUrls}
        defaultTeacherId={bootstrap.teacher?.id}
        defaultSchoolId={bootstrap.teacher?.schoolId}
        showRecentSessions={false}
        sheetConnected={sheetConnected}
        sheetStatus={sheetStatus}
      />
    </AppShell>
  );
}
