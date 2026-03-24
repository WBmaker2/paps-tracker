import { describe, expect, it, vi } from "vitest";

import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";
import { rebuildGoogleSheetSummaries } from "../../src/lib/google/sheets-rebuild";

const createClient = (overrides?: Partial<GoogleSheetsClient>): GoogleSheetsClient => ({
  getSpreadsheet: vi.fn(async () => ({
    spreadsheetId: "sheet-123",
    sheets: []
  })),
  readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
    if (range === "'설정'!A2:F200") {
      return [
        ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
        ["__PAPS_SCHOOL", "demo-school", "Demo Elementary", "https://docs.google.com/spreadsheets/d/sheet-123/edit", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
        ["__PAPS_TEACHER", "demo-teacher", "demo-school", "Demo Teacher", "demo-teacher@example.com", ""],
        ["__PAPS_TEACHER_META", "demo-teacher", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z", "", ""],
        ["__PAPS_CLASS", "demo-class-5-1", "demo-school", "2026", "5", "1"],
        ["__PAPS_CLASS_META", "demo-class-5-1", "5-1", "Y", "", ""],
        ["__PAPS_SESSION", "practice-1", "demo-school", "demo-teacher", "2026", "5-1 Shuttle Run A"],
        ["__PAPS_SESSION_META", "practice-1", "5", "practice", "single", "shuttle-run"],
        ["__PAPS_SESSION_STATUS", "practice-1", "N", "2026-03-24T09:10:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "practice-1", "demo-class-5-1", "shuttle-run", "0", ""],
        ["__PAPS_SESSION", "practice-2", "demo-school", "demo-teacher", "2026", "5-1 Shuttle Run B"],
        ["__PAPS_SESSION_META", "practice-2", "5", "practice", "single", "shuttle-run"],
        ["__PAPS_SESSION_STATUS", "practice-2", "N", "2026-03-24T09:30:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "practice-2", "demo-class-5-1", "shuttle-run", "0", ""],
        ["__PAPS_SESSION", "official-1", "demo-school", "demo-teacher", "2026", "5-1 Sit And Reach"],
        ["__PAPS_SESSION_META", "official-1", "5", "official", "single", "sit-and-reach"],
        ["__PAPS_SESSION_STATUS", "official-1", "N", "2026-03-24T10:00:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "official-1", "demo-class-5-1", "sit-and-reach", "0", ""]
      ];
    }

    if (range === "'학생명단'!A2:I1000") {
      return [["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]];
    }

    if (range === "'세션기록'!A2:U5000") {
      return [
        [
          "attempt-1",
          "practice-1",
          "5-1 Shuttle Run A",
          "2026",
          "2026-03-24",
          "연습",
          "1반형",
          "5-1",
          "1",
          "왕복오래달리기",
          "laps",
          "student-kim",
          "Kim",
          "1",
          "30",
          "Y",
          "demo-teacher@example.com",
          "",
          "2026-03-24 09:11:00",
          "완료",
          ""
        ],
        [
          "attempt-2",
          "practice-2",
          "5-1 Shuttle Run B",
          "2026",
          "2026-03-24",
          "연습",
          "1반형",
          "5-1",
          "1",
          "왕복오래달리기",
          "laps",
          "student-kim",
          "Kim",
          "1",
          "34",
          "N",
          "",
          "",
          "2026-03-24 09:31:00",
          "완료",
          "{\"clientSubmissionKey\":\"submit-2\"}"
        ],
        [
          "attempt-3",
          "practice-2",
          "5-1 Shuttle Run B",
          "2026",
          "2026-03-24",
          "연습",
          "1반형",
          "5-1",
          "1",
          "왕복오래달리기",
          "laps",
          "student-kim",
          "Kim",
          "2",
          "34",
          "Y",
          "demo-teacher@example.com",
          "",
          "2026-03-24 09:31:01",
          "완료",
          "{\"clientSubmissionKey\":\"submit-2\"}"
        ],
        [
          "attempt-4",
          "official-1",
          "5-1 Sit And Reach",
          "2026",
          "2026-03-24",
          "공식",
          "1반형",
          "5-1",
          "1",
          "앉아윗몸앞으로굽히기",
          "cm",
          "student-kim",
          "Kim",
          "1",
          "19",
          "Y",
          "demo-teacher@example.com",
          "4",
          "2026-03-24 10:01:00",
          "완료",
          ""
        ]
      ];
    }

    if (range === "'오류로그'!A2:G2000" || range === "'수정로그'!A2:I2000") {
      return [];
    }

    return [];
  }),
  appendRows: vi.fn(async () => ({})),
  updateRange: vi.fn(async () => ({})),
  ...overrides
});

describe("Google Sheets rebuild", () => {
  it("rebuilds 학생요약 and 공식평가요약 while ignoring duplicate clientSubmissionKey rows", async () => {
    const client = createClient();

    const result = await rebuildGoogleSheetSummaries({
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com",
      client
    });

    expect(result).toMatchObject({
      ok: true,
      updatedTabs: ["학생요약", "공식평가요약"],
      duplicateAttemptCount: 1,
      duplicateRecordCount: 1
    });

    const updateRange = vi.mocked(client.updateRange);
    expect(updateRange).toHaveBeenCalledTimes(2);

    const studentSummaryWrite = updateRange.mock.calls.find(
      ([, range]) => range === "'학생요약'!A1:L2000"
    );
    const officialSummaryWrite = updateRange.mock.calls.find(
      ([, range]) => range === "'공식평가요약'!A1:K2000"
    );

    expect(studentSummaryWrite?.[2][1]?.slice(0, 12)).toEqual([
      "student-kim",
      "Kim",
      "5",
      "1",
      "Shuttle Run",
      "34",
      "laps",
      "30",
      "4",
      "34",
      "2026-03-24",
      "지난 기록 대비 +4laps"
    ]);
    expect(officialSummaryWrite?.[2][1]?.slice(0, 11)).toEqual([
      "student-kim",
      "Kim",
      "5",
      "1",
      "Sit and Reach",
      "19",
      "cm",
      "4",
      "2026-03-24",
      "5-1 Sit And Reach",
      "공식 기록 완료"
    ]);
  });

  it("marks rebuildNeeded when one summary tab update fails", async () => {
    const client = createClient({
      updateRange: vi.fn(async (_spreadsheetId, range) => {
        if (range === "'공식평가요약'!A1:K2000") {
          throw new Error("write failed");
        }

        return {};
      })
    });

    const result = await rebuildGoogleSheetSummaries({
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com",
      client
    });

    expect(result).toMatchObject({
      ok: false,
      rebuildNeeded: true,
      failedTabs: ["공식평가요약"]
    });
  });
});
