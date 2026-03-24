import React from "react";

import { TeacherProgressChart } from "../../../src/components/charts/teacher-progress-chart";
import { AppShell } from "../../../src/components/layout/app-shell";
import { ResultTable, type TeacherResultRow } from "../../../src/components/teacher/result-table";
import { SyncStatusCard } from "../../../src/components/teacher/sync-status-card";
import { createPapsGoogleSheetTabPayloads } from "../../../src/lib/google/sheets";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import { loadTeacherPageState, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { selectPrimaryResultsSession } from "../../../src/lib/teacher-results";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";
import { cookies } from "next/headers";

const emptyResults: TeacherResultRow[] = [];

const countDuplicateAttempts = (attempts: TeacherResultRow["attempts"]): number => {
  const seenKeys = new Set<string>();
  let duplicateCount = 0;

  for (const attempt of attempts) {
    const key = attempt.clientSubmissionKey?.trim();

    if (!key) {
      continue;
    }

    if (seenKeys.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seenKeys.add(key);
  }

  return duplicateCount;
};

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
  const activeSession = selectPrimaryResultsSession(sessions);

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

  if (!activeSession || !store) {
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
  const rows: TeacherResultRow[] = (await store.listSessionRecords(activeSession.id)).map((record) => {
    const student = students.find((entry) => entry.id === record.studentId);
    const duplicateAttemptCount = countDuplicateAttempts(record.attempts);

    return {
      recordId: `${record.sessionId}:${record.studentId}`,
      sessionId: record.sessionId,
      studentId: record.studentId,
      studentName: student?.name ?? record.studentId,
      classLabel: classes.find((entry) => entry.id === student?.classId)?.label ?? "-",
      sessionName: activeSession.name ?? activeSession.id,
      eventLabel: getEventDefinition(activeSession.eventId).label,
      unit: record.unit,
      representativeAttemptId: record.representativeAttemptId,
      attempts: record.attempts,
      duplicateAttemptCount
    };
  });
  const duplicateAttemptCount = rows.reduce(
    (total, row) => total + (row.duplicateAttemptCount ?? 0),
    0
  );
  const focusRow = rows.find((row) => row.attempts.length > 0) ?? rows[0] ?? null;
  const focusSync = focusRow
    ? bootstrap.syncStatuses.find(
        (entry) =>
          entry.sessionId === focusRow.sessionId && entry.studentId === focusRow.studentId
      ) ?? null
    : null;
  const focusSyncMessage = focusRow
    ? bootstrap.syncErrorLogs
        .filter(
          (entry) =>
            entry.sessionId === focusRow.sessionId && entry.studentId === focusRow.studentId
        )
        .at(-1)?.message ?? null
    : null;
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
      title="결과 검토"
      description="대표값 선택, 시도 흐름, 재동기화 상태를 한 번에 확인합니다."
    >
      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <ResultTable rows={rows} />
        <div className="space-y-6">
          <TeacherProgressChart
            title={`${focusRow?.studentName ?? "선택 학생"} 추이`}
            attempts={focusRow?.attempts ?? []}
            unit={focusRow?.unit ?? ""}
          />
          {focusRow ? (
            <SyncStatusCard
              recordId={focusRow.recordId}
              status={focusSync?.status ?? "pending"}
              updatedAt={focusSync?.updatedAt ?? "-"}
              message={focusSyncMessage}
              rebuildSessionId={activeSession.id}
              duplicateAttemptCount={duplicateAttemptCount}
              initialRebuildNeeded={duplicateAttemptCount > 0}
            />
          ) : null}
          {sheetTabs.length > 0 ? (
            <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                    Sheet
                  </p>
                  <h2 className="text-lg font-semibold">프로토타입 탭 동기화 준비</h2>
                </div>
                <span className="rounded-full bg-ink/5 px-3 py-1 text-xs text-ink/70">
                  오류로그 {failedSyncCount}건
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {sheetTabs.map((tab) => (
                  <div key={tab.tabName} className="flex items-center justify-between gap-3 text-sm">
                    <span>{tab.tabName}</span>
                    <span className="text-ink/65">
                      {tab.header.length} cols · {tab.rows.length} rows
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
