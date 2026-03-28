import type { GoogleSheetCellValue, GoogleSheetTabPayload } from "./sheets";

export const SUMMARY_TAB_NAMES = ["학생요약", "공식평가요약"] as const;

export type SummaryTabName = (typeof SUMMARY_TAB_NAMES)[number];

export const escapeCsvValue = (value: GoogleSheetCellValue): string => {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
};

export const buildCsvHref = (tab: GoogleSheetTabPayload): string => {
  const lines = [tab.header, ...tab.rows].map((row) => row.map(escapeCsvValue).join(","));

  return `data:text/csv;charset=utf-8,${encodeURIComponent(lines.join("\n"))}`;
};

export const getSummaryTab = (
  tabs: GoogleSheetTabPayload[],
  tabName: SummaryTabName
): GoogleSheetTabPayload | null => tabs.find((tab) => tab.tabName === tabName) ?? null;

export const getSummaryTabs = (tabs: GoogleSheetTabPayload[]): GoogleSheetTabPayload[] =>
  SUMMARY_TAB_NAMES.map((tabName) => getSummaryTab(tabs, tabName)).filter(
    (tab): tab is GoogleSheetTabPayload => Boolean(tab)
  );

export const formatDisplayCell = (header: string, value: GoogleSheetCellValue): string => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (header === "공식등급") {
    return `${value}등급`;
  }

  return String(value);
};
