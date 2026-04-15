"use client";

import React, { useEffect, useMemo, useState } from "react";

import type { GoogleSheetTabPayload } from "../../lib/google/sheets";
import type {
  TeacherResultRowView,
  TeacherResultsViewModel,
  TeacherResultSyncView
} from "../../lib/teacher-results";
import { ResultTable } from "./result-table";
import { ResultsFilterPanel, type TeacherResultsFilterState } from "./results-filter-panel";
import {
  createDefaultFilterState,
  filterTeacherResultRows
} from "./teacher-results-workspace-filters";
import { TeacherResultsSidebar } from "./teacher-results-sidebar";

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
  syncStateByRecordId: initialSyncStateByRecordId,
  sheetTabs,
  failedSyncCount: initialFailedSyncCount,
  summariesNote: initialSummariesNote
}: Pick<
  TeacherResultsViewModel,
  "rows" | "filterOptions" | "initialFocusRecordId" | "syncStateByRecordId" | "summariesNote"
> & {
  sheetTabs: GoogleSheetTabPayload[];
  failedSyncCount: number;
}) {
  const [rows, setRows] = useState(initialRows);
  const [syncStateByRecordId, setSyncStateByRecordId] =
    useState<Record<string, TeacherResultSyncView>>(initialSyncStateByRecordId);
  const [summariesNote, setSummariesNote] = useState(initialSummariesNote);
  const [filterState, setFilterState] = useState<TeacherResultsFilterState>(createDefaultFilterState);
  const [focusedRecordId, setFocusedRecordId] = useState<string | null>(initialFocusRecordId);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    setSyncStateByRecordId(initialSyncStateByRecordId);
  }, [initialSyncStateByRecordId]);

  useEffect(() => {
    setSummariesNote(initialSummariesNote);
  }, [initialSummariesNote]);

  const filteredRows = useMemo(
    () => filterTeacherResultRows(rows, filterState),
    [rows, filterState]
  );
  const failedSyncCount = useMemo(() => {
    const derivedCount = Object.values(syncStateByRecordId).filter(
      (entry) => entry.status === "failed"
    ).length;

    return derivedCount || (Object.keys(syncStateByRecordId).length === 0 ? initialFailedSyncCount : 0);
  }, [initialFailedSyncCount, syncStateByRecordId]);

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

      <TeacherResultsSidebar
        focusedRow={focusedRow}
        focusedSync={focusedSync}
        sheetTabs={sheetTabs}
        failedSyncCount={failedSyncCount}
        summariesNote={summariesNote}
        rebuildNeeded={Boolean(focusedRow?.duplicateAttemptCount)}
        onSyncStatusChange={(nextSync) => {
          if (!focusedRow) {
            return;
          }

          setSyncStateByRecordId((currentState) => ({
            ...currentState,
            [focusedRow.recordId]: nextSync
          }));
        }}
        onSummariesRebuilt={() => {
          if (!focusedRow) {
            return;
          }

          setRows((currentRows) =>
            currentRows.map((row) =>
              row.sessionId === focusedRow.sessionId
                ? {
                    ...row,
                    duplicateAttemptCount: 0
                  }
                : row
            )
          );
          setSummariesNote("방금 학생요약과 공식평가요약을 다시 정리했습니다.");
        }}
      />
    </div>
  );
}
