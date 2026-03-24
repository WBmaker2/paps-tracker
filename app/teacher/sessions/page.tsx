import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../../src/components/teacher/session-form";
import { createGoogleSheetsStoreForRequest, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

export default async function TeacherSessionsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const store =
    process.env.NODE_ENV === "test"
      ? await createStoreForRequest()
      : spreadsheetId
        ? await createGoogleSheetsStoreForRequest({
            spreadsheetId,
            teacherEmail: teacherSession.email
          })
        : null;
  const bootstrap = store
    ? await store.getTeacherBootstrap({ teacherEmail: teacherSession.email })
    : {
        teacher: null,
        school: null,
        schools: [],
        classes: [],
        teachers: [],
        students: [],
        sessions: [],
        attempts: [],
        syncStatuses: [],
        syncErrorLogs: [],
        representativeSelectionAuditLogs: []
      };

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
        sheetConnected={Boolean(store)}
      />
    </AppShell>
  );
}
