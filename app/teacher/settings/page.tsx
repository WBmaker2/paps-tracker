import React from "react";
import { cookies } from "next/headers";

import { AppShell } from "../../../src/components/layout/app-shell";
import { TeacherSettingsManager } from "../../../src/components/teacher/settings-management";
import { createPapsGoogleSheetTabPayloads } from "../../../src/lib/google/sheets";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

export default async function TeacherSettingsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { bootstrap, sheetConnected } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });
  const school = bootstrap.teacher?.schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;
  const schoolId = school?.id ?? null;
  const classes = (
    schoolId
      ? bootstrap.classes.filter((entry) => entry.schoolId === schoolId)
      : bootstrap.classes
  ).slice().sort((left, right) => left.label.localeCompare(right.label));
  const teachers = schoolId
    ? bootstrap.teachers.filter((entry) => entry.schoolId === schoolId)
    : bootstrap.teachers;
  const students = schoolId
    ? bootstrap.students.filter(
        (entry) =>
          entry.schoolId === schoolId || classes.some((classroom) => classroom.id === entry.classId)
      )
    : bootstrap.students;
  const sessions = schoolId
    ? bootstrap.sessions.filter((entry) => entry.schoolId === schoolId)
    : bootstrap.sessions;
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const attempts = bootstrap.attempts.filter((entry) => sessionIds.has(entry.sessionId));
  const syncStatuses = bootstrap.syncStatuses.filter((entry) => sessionIds.has(entry.sessionId));
  const syncErrorLogs = bootstrap.syncErrorLogs.filter((entry) => sessionIds.has(entry.sessionId));
  const representativeSelectionAuditLogs = bootstrap.representativeSelectionAuditLogs.filter(
    (entry) => sessionIds.has(entry.sessionId)
  );
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
        <TeacherSettingsManager
          school={school}
          classes={classes}
          sheetConnected={sheetConnected}
        />
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
