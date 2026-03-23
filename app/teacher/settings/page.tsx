import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSettingsManager } from "../../../src/components/teacher/settings-management";
import { getDemoStore } from "../../../src/lib/demo-store";
import { createPapsGoogleSheetTabPayloads } from "../../../src/lib/google/sheets";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherSettingsPage() {
  const teacherSession = await requireTeacherSession();
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherSession.email);
  const school = teacher?.schoolId ? store.getSchool(teacher.schoolId) : store.listSchools()[0] ?? null;
  const classes = store
    .listClasses()
    .filter((classroom) => !school || classroom.schoolId === school.id)
    .sort((left, right) => left.label.localeCompare(right.label));
  const teachers = store
    .listTeachers()
    .filter((entry) => !school || entry.schoolId === school.id);
  const students = store
    .listStudents()
    .filter(
      (entry) =>
        !school ||
        entry.schoolId === school.id ||
        classes.some((classroom) => classroom.id === entry.classId)
    );
  const sessions = store.listSessions().filter((entry) => !school || entry.schoolId === school.id);
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const attempts = sessions.flatMap((session) =>
    store.listSessionRecords(session.id).flatMap((record) =>
      record.attempts.map((attempt) => ({
        id: attempt.id,
        sessionId: record.sessionId,
        studentId: record.studentId,
        eventId: record.eventId,
        unit: record.unit,
        attemptNumber: attempt.attemptNumber,
        measurement: attempt.measurement,
        createdAt: attempt.createdAt
      }))
    )
  );
  const syncStatuses = store.listSyncStatuses().filter((entry) => sessionIds.has(entry.sessionId));
  const syncErrorLogs = store.listSyncErrorLogs().filter((entry) => sessionIds.has(entry.sessionId));
  const representativeSelectionAuditLogs = store
    .listRepresentativeSelectionAuditLogs()
    .filter((entry) => sessionIds.has(entry.sessionId));
  const sheetTabs = school
    ? createPapsGoogleSheetTabPayloads({
        school,
        classes,
        teachers,
        students,
        sessions,
        attempts,
        syncStatuses,
        syncErrorLogs,
        representativeSelectionAuditLogs
      })
    : [];

  return (
    <AppShell
      eyebrow="Settings"
      title="학교 및 학급 설정"
      description="학교 정보 수정과 학급 추가를 바로 처리하는 MVP 관리 화면입니다."
    >
      <div className="space-y-6">
        <TeacherSettingsManager school={school} classes={classes} />
        {school ? (
          <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-semibold">구글 시트 탭 미리보기</h2>
                <p className="mt-1 text-sm text-ink/70">
                  현재 학교 데이터를 프로토타입 워크북 구조에 맞춰 7개 탭으로 직렬화합니다.
                </p>
              </div>
              <p className="text-sm text-ink/65">
                연결 시트: {school.sheetUrl ?? "아직 연결되지 않음"}
              </p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sheetTabs.map((tab) => (
                <article key={tab.tabName} className="rounded-2xl border border-ink/10 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{tab.tabName}</p>
                    <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70">
                      {tab.rows.length} rows
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink/65">{tab.header.join(" · ")}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
