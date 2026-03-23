import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { StudentTable } from "../../../src/components/teacher/student-table";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

export default async function TeacherStudentsPage() {
  const teacherSession = await requireTeacherSession();
  const store = await createStoreForRequest();
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.email });

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
      />
    </AppShell>
  );
}
