import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { StudentTable } from "../../../src/components/teacher/student-table";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherStudentsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });

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
        sheetConnected={sheetConnected}
      />
    </AppShell>
  );
}
