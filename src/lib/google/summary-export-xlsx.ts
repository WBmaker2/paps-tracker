import * as XLSX from "xlsx";

import type { GoogleSheetTabPayload } from "./sheets";
import { getSummaryTabs } from "./summary-export-utils";

export const buildSummaryWorkbook = (tabs: GoogleSheetTabPayload[]): Buffer => {
  const summaryTabs = getSummaryTabs(tabs);

  if (summaryTabs.length === 0) {
    throw new Error("요약으로 내보낼 데이터가 없습니다.");
  }

  const workbook = XLSX.utils.book_new();

  for (const tab of summaryTabs) {
    const sheet = XLSX.utils.aoa_to_sheet([tab.header, ...tab.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, tab.tabName);
  }

  return XLSX.write(workbook, {
    bookType: "xlsx",
    type: "buffer"
  }) as Buffer;
};
