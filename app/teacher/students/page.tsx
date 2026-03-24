import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { StudentTable } from "../../../src/components/teacher/student-table";
import { createGoogleSheetsStoreForRequest, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

export default async function TeacherStudentsPage() {
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
      eyebrow="Roster"
      title="학생 명단 관리"
      description="학급별 학생을 확인하고 추가하여 세션 대상자를 바로 준비합니다."
    >
      <StudentTable
        students={bootstrap.students}
        classes={bootstrap.classes}
        schoolId={bootstrap.teacher?.schoolId}
        sheetConnected={Boolean(store)}
      />
    </AppShell>
  );
}
