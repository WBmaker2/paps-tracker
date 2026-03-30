import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { ResultTable, type TeacherResultRow } from "../../../src/components/teacher/result-table";
import { TeacherResultsWorkspace } from "../../../src/components/teacher/teacher-results-workspace";
import { createPapsGoogleSheetTabPayloads } from "../../../src/lib/google/sheets";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { buildTeacherResultsViewModel } from "../../../src/lib/teacher-results";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { cookies } from "next/headers";

const emptyResults: TeacherResultRow[] = [];

export default async function TeacherResultsPage() {
  const teacherSession = await requireTeacherSession();
  const cookieStore = await cookies();
  const spreadsheetId = cookieStore.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;
  const { store, bootstrap, sheetConnected } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });
  const schoolId = bootstrap.teacher?.schoolId ?? null;
  const school = schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;
  const sessions = bootstrap.sessions;

  if (!sheetConnected) {
    return (
      <AppShell
        eyebrow="Results"
        title="결과 검토"
        description="구글 시트를 다시 연결하면 대표값 선택과 동기화 상태를 확인할 수 있습니다."
      >
        <ResultTable rows={emptyResults} />
      </AppShell>
    );
  }

  if (!store) {
    return (
      <AppShell
        eyebrow="Results"
        title="결과 검토"
        description="대표값 선택과 동기화 상태를 확인할 세션이 아직 없습니다."
      >
        <ResultTable rows={emptyResults} />
      </AppShell>
    );
  }

  const classes = bootstrap.classes;
  const students = bootstrap.students;
  const recordsBySession = Object.fromEntries(
    await Promise.all(
      sessions.map(async (session) => [session.id, await store.listSessionRecords(session.id)] as const)
    )
  );
  const viewModel = buildTeacherResultsViewModel({
    classes,
    students,
    sessions,
    recordsBySession,
    syncStatuses: bootstrap.syncStatuses,
    syncErrorLogs: bootstrap.syncErrorLogs
  });
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const sheetTabs = school
    ? createPapsGoogleSheetTabPayloads({
        school,
        classes,
        teachers: schoolId
          ? bootstrap.teachers.filter((entry) => entry.schoolId === schoolId)
          : bootstrap.teachers,
        students,
        sessions,
        attempts: bootstrap.attempts.filter((entry) => sessionIds.has(entry.sessionId)),
        syncStatuses: bootstrap.syncStatuses,
        syncErrorLogs: bootstrap.syncErrorLogs,
        representativeSelectionAuditLogs: bootstrap.representativeSelectionAuditLogs
      })
    : [];
  const failedSyncCount = sheetTabs.find((tab) => tab.tabName === "오류로그")?.rows.length ?? 0;

  return (
    <AppShell
      eyebrow="Results"
      title="측정 결과 검토"
      description="대표 기록 확정, 요약 재계산, 시트 반영 현황을 한 화면에서 확인합니다."
    >
      <TeacherResultsWorkspace
        rows={viewModel.rows}
        filterOptions={viewModel.filterOptions}
        initialFocusRecordId={viewModel.initialFocusRecordId}
        syncStateByRecordId={viewModel.syncStateByRecordId}
        sheetTabs={sheetTabs}
        failedSyncCount={failedSyncCount}
        summariesNote={viewModel.summariesNote}
      />
    </AppShell>
  );
}
