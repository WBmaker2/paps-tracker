import React from "react";

import { AppShell } from "../../src/components/layout/app-shell";
import { TeacherSessionWorkspace } from "../../src/components/teacher/session-form";
import { getDemoStore } from "../../src/lib/demo-store";
import { requireTeacherSession } from "../../src/lib/teacher-auth";

const formatSessionBadge = (count: number, label: string) => ({
  label,
  value: `${count}개`
});

export default async function TeacherDashboardPage() {
  const teacherSession = await requireTeacherSession();
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherSession.email);
  const schoolId = teacher?.schoolId;
  const schools = store.listSchools().filter((school) => !schoolId || school.id === schoolId);
  const classes = store.listClasses().filter((classroom) => !schoolId || classroom.schoolId === schoolId);
  const students = store.listStudents().filter((student) => !schoolId || student.schoolId === schoolId);
  const sessions = store.listSessions().filter((session) => !schoolId || session.schoolId === schoolId);
  const summaryCards = [
    formatSessionBadge(schools.length, "학교"),
    formatSessionBadge(classes.length, "학급"),
    formatSessionBadge(students.length, "학생"),
    formatSessionBadge(sessions.length, "세션")
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
        classes={classes}
        sessions={sessions}
        defaultTeacherId={teacher?.id}
        defaultSchoolId={schoolId}
      />
    </AppShell>
  );
}
