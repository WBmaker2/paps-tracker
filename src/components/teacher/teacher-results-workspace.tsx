"use client";

import React, { useEffect, useMemo, useState } from "react";

import { TeacherProgressChart } from "../charts/teacher-progress-chart";
import type { GoogleSheetTabPayload } from "../../lib/google/sheets";
import type {
  TeacherResultRowView,
  TeacherResultsViewModel,
  TeacherResultSyncView
} from "../../lib/teacher-results";
import { ResultTable } from "./result-table";
import { ResultsFilterPanel, type TeacherResultsFilterState } from "./results-filter-panel";
import { SummaryExportsCard } from "./summary-exports-card";
import { SyncStatusCard } from "./sync-status-card";

const createDefaultFilterState = (): TeacherResultsFilterState => ({
  query: "",
  grade: "all",
  classId: "all",
  eventId: "all",
  sessionType: "all"
});

const filterRows = (
  rows: TeacherResultRowView[],
  filterState: TeacherResultsFilterState
): TeacherResultRowView[] =>
  rows.filter((row) => {
    if (
      filterState.query &&
      !row.studentNameNormalized.includes(filterState.query.trim().toLocaleLowerCase("ko-KR"))
    ) {
      return false;
    }

    if (filterState.grade !== "all" && row.gradeLevel !== filterState.grade) {
      return false;
    }

    if (filterState.classId !== "all" && row.classId !== filterState.classId) {
      return false;
    }

    if (filterState.eventId !== "all" && row.eventId !== filterState.eventId) {
      return false;
    }

    if (filterState.sessionType !== "all" && row.sessionType !== filterState.sessionType) {
      return false;
    }

    return true;
  });

function ResultCountSummary({
  visibleCount,
  totalCount
}: {
  visibleCount: number;
  totalCount: number;
}) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-ink/80">
        현재 {visibleCount}건 / 전체 {totalCount}건
      </p>
    </section>
  );
}

function EmptyFilteredState({ onReset }: { onReset: () => void }) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">조건에 맞는 측정 결과가 없습니다.</h2>
      <p className="mt-2 text-sm text-ink/70">
        검색어를 지우거나 필터를 초기화하면 전체 결과를 다시 볼 수 있습니다.
      </p>
      <button
        type="button"
        className="mt-4 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
        onClick={onReset}
      >
        필터 초기화
      </button>
    </section>
  );
}

export function TeacherResultsWorkspace({
  rows: initialRows,
  filterOptions,
  initialFocusRecordId,
  syncStateByRecordId,
  sheetTabs,
  failedSyncCount,
  summariesNote
}: Pick<
  TeacherResultsViewModel,
  "rows" | "filterOptions" | "initialFocusRecordId" | "syncStateByRecordId" | "summariesNote"
> & {
  sheetTabs: GoogleSheetTabPayload[];
  failedSyncCount: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [filterState, setFilterState] = useState<TeacherResultsFilterState>(createDefaultFilterState);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(initialFocusRecordId);

  const filteredRows = useMemo(() => filterRows(rows, filterState), [rows, filterState]);

  useEffect(() => {
    if (filteredRows.length === 0) {
      setFocusedRecordId(null);
      return;
    }

    if (focusedRecordId && filteredRows.some((row) => row.recordId === focusedRecordId)) {
      return;
    }

    setFocusedRecordId(filteredRows[0]?.recordId ?? null);
  }, [filteredRows, focusedRecordId]);

  const focusedRow =
    filteredRows.find((row) => row.recordId === focusedRecordId) ?? filteredRows[0] ?? null;
  const focusedSync: TeacherResultSyncView | null = focusedRow
    ? syncStateByRecordId[focusedRow.recordId] ?? null
    : null;

  const resetFilters = () => {
    setFilterState(createDefaultFilterState());
    setFocusedRecordId(initialFocusRecordId);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <div className="space-y-6">
        <ResultsFilterPanel
          value={filterState}
          options={filterOptions}
          onChange={setFilterState}
          onReset={resetFilters}
        />
        <ResultCountSummary visibleCount={filteredRows.length} totalCount={rows.length} />
        {filteredRows.length > 0 ? (
          <ResultTable
            rows={filteredRows}
            activeRecordId={focusedRow?.recordId ?? null}
            onRecordFocus={setFocusedRecordId}
            onRepresentativeChange={(recordId, representativeAttemptId) => {
              setRows((currentRows) =>
                currentRows.map((row) =>
                  row.recordId === recordId
                    ? {
                        ...row,
                        representativeAttemptId
                      }
                    : row
                )
              );
            }}
          />
        ) : (
          <EmptyFilteredState onReset={resetFilters} />
        )}
      </div>

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
            initialRebuildNeeded={focusedRow.duplicateAttemptCount > 0}
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
    </div>
  );
}
