import React from "react";

import { TeacherProgressChart } from "../../../src/components/charts/teacher-progress-chart";
import { AppShell } from "../../../src/components/layout/app-shell";
import { ResultTable, type TeacherResultRow } from "../../../src/components/teacher/result-table";
import { SyncStatusCard } from "../../../src/components/teacher/sync-status-card";
import { getDemoStore } from "../../../src/lib/demo-store";
import { createPapsGoogleSheetTabPayloads } from "../../../src/lib/google/sheets";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import type { PAPSSession } from "../../../src/lib/paps/types";
import { requireTeacherSession } from "../../../src/lib/teacher-auth";

const emptyResults: TeacherResultRow[] = [];

export const selectPrimaryResultsSession = (sessions: PAPSSession[]): PAPSSession | null =>
  [...sessions].sort((left, right) => {
    const leftOpenRank = left.isOpen ? 1 : 0;
    const rightOpenRank = right.isOpen ? 1 : 0;

    return (
      rightOpenRank - leftOpenRank ||
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
    );
  })[0] ?? null;

export default async function TeacherResultsPage() {
  const teacherSession = await requireTeacherSession();
  const store = getDemoStore();
  const teacher = store.getTeacherByEmail(teacherSession.email);
  const schoolId = teacher?.schoolId;
  const school = schoolId ? store.getSchool(schoolId) : store.listSchools()[0] ?? null;
  const sessions = store.listSessions().filter((session) => !schoolId || session.schoolId === schoolId);
  const activeSession = selectPrimaryResultsSession(sessions);

  if (!activeSession) {
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

  const classes = store.listClasses().filter((entry) => !schoolId || entry.schoolId === schoolId);
  const students = store
    .listStudents()
    .filter(
      (entry) =>
        !schoolId ||
        entry.schoolId === schoolId ||
        classes.some((classroom) => classroom.id === entry.classId)
    );
  const rows: TeacherResultRow[] = store.listSessionRecords(activeSession.id).map((record) => {
    const student = students.find((entry) => entry.id === record.studentId);

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
      attempts: record.attempts
    };
  });
  const focusRow = rows.find((row) => row.attempts.length > 0) ?? rows[0] ?? null;
  const focusSync = focusRow
    ? store.getSyncStatus({
        sessionId: focusRow.sessionId,
        studentId: focusRow.studentId
      })
    : null;
  const focusSyncMessage = focusRow
    ? store
        .listSyncErrorLogs({
          sessionId: focusRow.sessionId,
          studentId: focusRow.studentId
        })
        .at(-1)?.message ?? null
    : null;
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const sheetTabs = school
    ? createPapsGoogleSheetTabPayloads({
        school,
        classes,
        teachers: store.listTeachers().filter((entry) => !schoolId || entry.schoolId === schoolId),
        students,
        sessions,
        attempts: sessions.flatMap((session) =>
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
        ),
        syncStatuses: store.listSyncStatuses().filter((entry) => sessionIds.has(entry.sessionId)),
        syncErrorLogs: store.listSyncErrorLogs().filter((entry) => sessionIds.has(entry.sessionId)),
        representativeSelectionAuditLogs: store
          .listRepresentativeSelectionAuditLogs()
          .filter((entry) => sessionIds.has(entry.sessionId))
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
          {focusRow && focusSync ? (
            <SyncStatusCard
              recordId={focusRow.recordId}
              status={focusSync.status}
              updatedAt={focusSync.updatedAt}
              message={focusSyncMessage}
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
