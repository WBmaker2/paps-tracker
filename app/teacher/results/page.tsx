import React from "react";

import { AppShell } from "../../../src/components/layout/app-shell";
import { ResultTable, type TeacherResultRow } from "../../../src/components/teacher/result-table";
import { TeacherDataRefresh } from "../../../src/components/teacher/teacher-data-refresh";
import { TeacherResultsWorkspace } from "../../../src/components/teacher/teacher-results-workspace";
import { TeacherSheetAutoLoader } from "../../../src/components/teacher/teacher-sheet-auto-loader";
import { FourFactorRoundResultPanel } from "../../../src/components/teacher/four-factor-round-result-panel";
import { adaptRoundResult } from "../../../src/components/teacher/four-factor-round-adapter";
import type { PAPSAssessmentRound } from "../../../src/lib/paps/types";
import { buildTeacherStateVersion } from "../../../src/lib/google/sheet-state-version";
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
  const { store, bootstrap, sheetConnected, sheetStatus } = await loadTeacherPageState({
    teacherEmail: teacherSession.email,
    spreadsheetId
  });
  const initialVersion =
    sheetConnected && bootstrap.teacher ? buildTeacherStateVersion(bootstrap) : null;
  const schoolId = bootstrap.teacher?.schoolId ?? null;
  const school = schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;
  const sessions = bootstrap.sessions;
  const assessmentRounds = bootstrap.assessmentRounds ?? [];
  const studentRoundResults = bootstrap.studentRoundResults ?? [];

  if (!sheetConnected) {
    return (
      <AppShell
        eyebrow="Results"
        title="결과 검토"
        description={sheetStatus.summary}
      >
        <TeacherDataRefresh initialVersion={initialVersion} pollIntervalMs={30000} />
        <TeacherSheetAutoLoader sheetStatus={sheetStatus} />
        {sheetStatus.detail ? (
          <section className="rounded-[1.75rem] border border-amber-300/70 bg-amber-50 px-5 py-4 text-sm text-ink/80">
            {sheetStatus.detail}
          </section>
        ) : null}
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
        <TeacherDataRefresh initialVersion={initialVersion} pollIntervalMs={30000} />
        <TeacherSheetAutoLoader sheetStatus={sheetStatus} />
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
      <TeacherDataRefresh initialVersion={initialVersion} pollIntervalMs={30000} />
      <TeacherSheetAutoLoader sheetStatus={sheetStatus} />
      {assessmentRounds.map((round: PAPSAssessmentRound) => (
        <FourFactorRoundResultPanel
          key={round.id}
          roundId={round.id}
          roundName={round.name}
          roundRevision={round.revision}
          results={studentRoundResults
            .filter((result) => result.roundId === round.id)
            .map(adaptRoundResult)}
        />
      ))}
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
