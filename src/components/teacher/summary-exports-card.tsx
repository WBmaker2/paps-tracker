import React from "react";

import type { GoogleSheetCellValue, GoogleSheetTabPayload } from "../../lib/google/sheets";

const escapeCsvValue = (value: GoogleSheetCellValue): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
};

const buildCsvHref = (tab: GoogleSheetTabPayload): string => {
  const lines = [tab.header, ...tab.rows].map((row) => row.map(escapeCsvValue).join(","));

  return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
};

const getTab = (tabs: GoogleSheetTabPayload[], tabName: string): GoogleSheetTabPayload | null =>
  tabs.find((tab) => tab.tabName === tabName) ?? null;

const formatDisplayCell = (header: string, value: GoogleSheetCellValue): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (header === "공식등급") {
    return `${value}등급`;
  }

  return String(value);
};

export function SummaryExportsCard({ tabs }: { tabs: GoogleSheetTabPayload[] }) {
  const studentSummaryTab = getTab(tabs, "학생요약");
  const officialSummaryTab = getTab(tabs, "공식평가요약");

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
          <h2 className="text-lg font-semibold">요약 내려받기와 공식 기록 확인</h2>
          <p className="mt-1 text-sm text-ink/70">
            학생요약과 공식평가요약을 바로 내려받고, 공식 기록은 화면에서 바로 확인합니다.
          </p>
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
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-base font-semibold">공식평가요약 미리보기</h3>
        {officialSummaryTab && officialSummaryTab.rows.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr>
                  {officialSummaryTab.header.map((header) => (
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
                {officialSummaryTab.rows.map((row, rowIndex) => (
                  <tr key={`${rowIndex}-${row[0] ?? "row"}`} className="bg-canvas/40">
                    {officialSummaryTab.header.map((header, columnIndex) => (
                      <td
                        key={`${header}-${rowIndex}`}
                        className="rounded-md px-3 py-2 text-ink"
                      >
                        {formatDisplayCell(header, row[columnIndex] ?? null)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink/70">
            아직 공식 대표 기록이 없어 공식평가요약이 비어 있습니다.
          </p>
        )}
      </div>
    </section>
  );
}
