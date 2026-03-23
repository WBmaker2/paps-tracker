import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../../src/components/teacher/session-form";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

export default async function TeacherSessionsPage() {
  const teacherSession = await requireTeacherSession();
  const store = await createStoreForRequest();
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.email });

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
      />
    </AppShell>
  );
}
