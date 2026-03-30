import React from "react";

import type { GoogleSheetTabPayload } from "../../lib/google/sheets";
import {
  buildCsvHref,
  formatDisplayCell,
  getSummaryTab
} from "../../lib/google/summary-export-utils";

function SummaryPreviewTable({
  title,
  tab,
  emptyMessage
}: {
  title: string;
  tab: GoogleSheetTabPayload | null;
  emptyMessage: string;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-base font-semibold">{title}</h3>
      {tab && tab.rows.length > 0 ? (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr>
                {tab.header.map((header) => (
                  <th
                    key={header}
                    scope="col"
                    className="px-3 py-2 text-left font-medium text-ink/65"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row[0] ?? "row"}`} className="bg-canvas/40">
                  {tab.header.map((header, columnIndex) => (
                    <td key={`${header}-${rowIndex}`} className="rounded-md px-3 py-2 text-ink">
                      {formatDisplayCell(header, row[columnIndex] ?? null)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink/70">{emptyMessage}</p>
      )}
    </div>
  );
}

export function SummaryExportsCard({
  tabs,
  note
}: {
  tabs: GoogleSheetTabPayload[];
  note?: string;
}) {
  const studentSummaryTab = getSummaryTab(tabs, "학생요약");
  const officialSummaryTab = getSummaryTab(tabs, "공식평가요약");

  if (!studentSummaryTab && !officialSummaryTab) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
            Summary
          </p>
          <h2 className="text-lg font-semibold">요약 내려받기와 결과 미리보기</h2>
          <p className="mt-1 text-sm text-ink/70">
            학생요약과 공식평가요약을 바로 내려받고, 두 요약표를 화면에서 함께 확인합니다.
          </p>
          {note ? <p className="mt-2 text-sm text-ink/65">{note}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {studentSummaryTab ? (
            <a
              href={buildCsvHref(studentSummaryTab)}
              download="학생요약.csv"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
            >
              학생요약 CSV 다운로드
            </a>
          ) : null}
          {officialSummaryTab ? (
            <a
              href={buildCsvHref(officialSummaryTab)}
              download="공식평가요약.csv"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
            >
              공식평가요약 CSV 다운로드
            </a>
          ) : null}
          {(studentSummaryTab || officialSummaryTab) ? (
            <a
              href="/api/results/export.xlsx"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
            >
              요약 XLSX 다운로드
            </a>
          ) : null}
        </div>
      </div>

      <SummaryPreviewTable
        title="학생요약 미리보기"
        tab={studentSummaryTab}
        emptyMessage="아직 대표 기록이 없어 학생요약이 비어 있습니다."
      />
      <SummaryPreviewTable
        title="공식평가요약 미리보기"
        tab={officialSummaryTab}
        emptyMessage="아직 공식 대표 기록이 없어 공식평가요약이 비어 있습니다."
      />
    </section>
  );
}
