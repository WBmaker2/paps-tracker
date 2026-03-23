import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../../src/components/teacher/session-form";
import { getDemoStore } from "../../../src/lib/demo-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherSessionsPage() {
  const teacherSession = await requireTeacherSession();
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherSession.email);
  const schoolId = teacher?.schoolId;
  const classes = store.listClasses().filter((classroom) => !schoolId || classroom.schoolId === schoolId);
  const sessions = store.listSessions().filter((session) => !schoolId || session.schoolId === schoolId);

  return (
    <AppShell
      eyebrow="Sessions"
      title="세션 운영"
      description="새 세션을 만들고, 진행 중 세션을 열기와 닫기로 제어합니다."
    >
      <TeacherSessionWorkspace
        classes={classes}
        sessions={sessions}
        defaultTeacherId={teacher?.id}
        defaultSchoolId={schoolId}
        showRecentSessions={false}
      />
    </AppShell>
  );
}
