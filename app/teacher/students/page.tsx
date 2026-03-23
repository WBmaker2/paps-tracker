import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { StudentTable } from "../../../src/components/teacher/student-table";
import { getDemoStore } from "../../../src/lib/demo-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherStudentsPage() {
  const teacherSession = await requireTeacherSession();
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherSession.email);
  const schoolId = teacher?.schoolId;
  const classes = store.listClasses().filter((classroom) => !schoolId || classroom.schoolId === schoolId);
  const students = store.listStudents().filter((student) => !schoolId || student.schoolId === schoolId);

  return (
    <AppShell
      eyebrow="Roster"
      title="학생 명단 관리"
      description="학급별 학생을 확인하고 추가하여 세션 대상자를 바로 준비합니다."
    >
      <StudentTable students={students} classes={classes} schoolId={schoolId} />
    </AppShell>
  );
}
