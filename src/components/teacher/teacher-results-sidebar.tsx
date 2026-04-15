import React from "react";

import { TeacherProgressChart } from "../charts/teacher-progress-chart";
import type { GoogleSheetTabPayload } from "../../lib/google/sheets";
import type {
  TeacherResultRowView,
  TeacherResultSyncView
} from "../../lib/teacher-results";
import { SummaryExportsCard } from "./summary-exports-card";
import { SyncStatusCard } from "./sync-status-card";

export interface TeacherResultsSidebarProps {
  focusedRow: TeacherResultRowView | null;
  focusedSync: TeacherResultSyncView | null;
  sheetTabs: GoogleSheetTabPayload[];
  failedSyncCount: number;
  summariesNote?: string;
  rebuildNeeded?: boolean;
  onSyncStatusChange?: (sync: TeacherResultSyncView) => void;
  onSummariesRebuilt?: () => void;
}

export function TeacherResultsSidebar({
  focusedRow,
  focusedSync,
  sheetTabs,
  failedSyncCount,
  summariesNote,
  rebuildNeeded = false,
  onSyncStatusChange,
  onSummariesRebuilt
}: TeacherResultsSidebarProps) {
  return (
    <div className="space-y-6">
      <TeacherProgressChart
        title={`${focusedRow?.studentName ?? "선택 학생"} 추이`}
        attempts={focusedRow?.attempts ?? []}
        unit={focusedRow?.unit ?? ""}
      />
      {focusedRow && focusedSync ? (
        <SyncStatusCard
          recordId={focusedRow.recordId}
          status={focusedSync.status}
          updatedAt={focusedSync.updatedAt}
          message={focusedSync.message}
          rebuildSessionId={focusedRow.sessionId}
          duplicateAttemptCount={focusedRow.duplicateAttemptCount}
          initialRebuildNeeded={rebuildNeeded}
          onSyncStatusChange={onSyncStatusChange}
          onSummariesRebuilt={onSummariesRebuilt}
        />
      ) : null}
      {sheetTabs.length > 0 ? (
        <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                Sheet
              </p>
              <h2 className="text-lg font-semibold">구글 시트 반영 현황</h2>
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
      <SummaryExportsCard tabs={sheetTabs} note={summariesNote} />
    </div>
  );
}
