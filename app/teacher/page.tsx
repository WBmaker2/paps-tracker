import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../src/components/teacher/session-form";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../src/lib/teacher-auth";

const formatSessionBadge = (count: number, label: string) => ({
  label,
  value: `${count}개`
});

export default async function TeacherDashboardPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });
  const summaryCards = [
    formatSessionBadge(bootstrap.schools.length, "학교"),
    formatSessionBadge(bootstrap.classes.length, "학급"),
    formatSessionBadge(bootstrap.students.length, "학생"),
    formatSessionBadge(bootstrap.sessions.length, "세션")
  ];

  return (
    <AppShell
      eyebrow="Teacher"
      title="교사 대시보드"
      description="학교 현황, 세션 생성, 결과 검토 진입점을 한 화면에서 관리합니다."
    >
      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map((card) => (
          <article
            key={card.label}
            className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-ink/65">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold">{card.value}</p>
          </article>
        ))}
      </section>
      <TeacherSessionWorkspace
        classes={bootstrap.classes}
        sessions={bootstrap.sessions}
        defaultTeacherId={bootstrap.teacher?.id}
        defaultSchoolId={bootstrap.teacher?.schoolId}
        sheetConnected={sheetConnected}
      />
    </AppShell>
  );
}
