import { vi } from "vitest";

import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";

export const createClient = (overrides?: Partial<GoogleSheetsClient>): GoogleSheetsClient => {
  const client: GoogleSheetsClient = {
    getSpreadsheet: vi.fn(async () => ({
      spreadsheetId: "sheet-123",
      sheets: []
    })),
    readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
      if (range === "'설정'!A2:F") {
        return [
          ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
          ["__PAPS_SCHOOL", "demo-school", "Demo Elementary", "https://docs.google.com/spreadsheets/d/sheet-123/edit", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
          ["__PAPS_TEACHER", "demo-teacher", "demo-school", "Demo Teacher", "demo-teacher@example.com", ""],
          ["__PAPS_TEACHER_META", "demo-teacher", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z", "", ""],
          ["__PAPS_CLASS", "demo-class-5-1", "demo-school", "2026", "5", "1"],
          ["__PAPS_CLASS_META", "demo-class-5-1", "5-1", "Y", "", ""],
          ["__PAPS_SESSION", "session-1", "demo-school", "demo-teacher", "2026", "5-1 Sit And Reach"],
          ["__PAPS_SESSION_META", "session-1", "5", "official", "single", "sit-and-reach"],
          ["__PAPS_SESSION_STATUS", "session-1", "Y", "2026-03-24T09:10:00.000Z", "", ""],
          ["__PAPS_SESSION_TARGET", "session-1", "demo-class-5-1", "sit-and-reach", "0", ""]
        ];
      }

      if (range === "'학생명단'!A2:I") {
        return [["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]];
      }

      if (range === "'세션기록'!A2:U" || range === "'오류로그'!A2:G" || range === "'수정로그'!A2:I") {
        return [];
      }

      return [];
    }),
    readRanges: vi.fn(async function (
      this: GoogleSheetsClient,
      spreadsheetId: string,
      ranges: string[]
    ) {
      return Promise.all(ranges.map((range) => this.readRange(spreadsheetId, range)));
    }),
    appendRows: vi.fn(async () => ({
      spreadsheetId: "sheet-123",
      updates: {
        updatedRange: "'세션기록'!A2:U"
      }
    })),
    updateRange: vi.fn(async () => ({
      spreadsheetId: "sheet-123"
    })),
    ...overrides
  };

  return client;
};
