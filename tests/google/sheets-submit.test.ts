import { describe, expect, it, vi } from "vitest";

import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";
import type { PAPSAttempt } from "../../src/lib/paps/types";
import { parseRecordNote } from "../../src/lib/google/sheets-record-note";
import {
  appendStudentSubmissionToSheet,
  dedupeAttemptsByClientSubmissionKey,
  updateStudentSubmissionInSheet
} from "../../src/lib/google/sheets-submit";

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
        ["__PAPS_SESSION", "session-1", "demo-school", "demo-teacher", "2026", "5-1 Sit And Reach"],
        ["__PAPS_SESSION_META", "session-1", "5", "official", "single", "sit-and-reach"],
        ["__PAPS_SESSION_STATUS", "session-1", "Y", "2026-03-24T09:10:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "session-1", "demo-class-5-1", "sit-and-reach", "0", ""]
      ];
    }

    if (range === "'학생명단'!A2:I1000") {
      return [["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]];
    }

    if (range === "'세션기록'!A2:U5000" || range === "'오류로그'!A2:G2000" || range === "'수정로그'!A2:I2000") {
      return [];
    }

    return [];
  }),
  appendRows: vi.fn(async () => ({
    spreadsheetId: "sheet-123",
    updates: {
      updatedRange: "'세션기록'!A2:U2"
    }
  })),
  updateRange: vi.fn(async () => ({
    spreadsheetId: "sheet-123"
  })),
  ...overrides
});

describe("Google Sheets student submit", () => {
  it("returns success only when the raw record append succeeds", async () => {
    const failingClient = createClient({
      appendRows: vi.fn(async () => {
        throw new Error("Append failed.");
      })
    });

    await expect(
      appendStudentSubmissionToSheet({
        spreadsheetId: "sheet-123",
        sessionId: "session-1",
        studentId: "student-kim",
        measurement: 24,
        clientSubmissionKey: "submit-1",
        client: failingClient
      })
    ).resolves.toMatchObject({
      ok: false,
      error: "Append failed."
    });

    const successClient = createClient();

    const successResult = await appendStudentSubmissionToSheet({
      spreadsheetId: "sheet-123",
      sessionId: "session-1",
      studentId: "student-kim",
      measurement: 24,
      clientSubmissionKey: "submit-1",
      client: successClient
    });

    expect(successResult).toMatchObject({
      ok: true,
      result: {
        student: {
          id: "student-kim",
          name: "Kim"
        }
      }
    });
    expect(successResult.ok ? successResult.result.historyAttempts : []).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        sessionName: "5-1 Sit And Reach",
        eventId: "sit-and-reach",
        isCurrentSession: true,
        measurement: 24
      })
    ]);
    expect(successClient.updateRange).not.toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A1:L2000",
      expect.any(Array)
    );
    expect(successClient.updateRange).not.toHaveBeenCalledWith(
      "sheet-123",
      "'공식평가요약'!A1:K2000",
      expect.any(Array)
    );
    expect(successClient.appendRows).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A:L",
      [expect.arrayContaining(["student-kim", "Kim"])]
    );
  });

  it("deduplicates duplicate clientSubmissionKey values when building student-facing results", () => {
    const attempts: PAPSAttempt[] = [
      {
        id: "attempt-1",
        attemptNumber: 1,
        measurement: 18,
        createdAt: "2026-03-24T09:00:00.000Z",
        clientSubmissionKey: "submit-1"
      },
      {
        id: "attempt-2",
        attemptNumber: 2,
        measurement: 18,
        createdAt: "2026-03-24T09:00:01.000Z",
        clientSubmissionKey: "submit-1"
      },
      {
        id: "attempt-3",
        attemptNumber: 3,
        measurement: 21,
        createdAt: "2026-03-24T09:10:00.000Z",
        clientSubmissionKey: "submit-2"
      }
    ];

    expect(dedupeAttemptsByClientSubmissionKey(attempts).map((attempt) => attempt.id)).toEqual([
      "attempt-1",
      "attempt-3"
    ]);
  });

  it("stores composite step-test detail inside the sheet record note", async () => {
    const stepTestClient = createClient({
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'설정'!A2:F200") {
          return [
            ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
            ["__PAPS_SCHOOL", "demo-school", "Demo Elementary", "https://docs.google.com/spreadsheets/d/sheet-123/edit", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
            ["__PAPS_TEACHER", "demo-teacher", "demo-school", "Demo Teacher", "demo-teacher@example.com", ""],
            ["__PAPS_TEACHER_META", "demo-teacher", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z", "", ""],
            ["__PAPS_CLASS", "demo-class-5-1", "demo-school", "2026", "5", "1"],
            ["__PAPS_CLASS_META", "demo-class-5-1", "5-1", "Y", "", ""],
            ["__PAPS_SESSION", "session-step", "demo-school", "demo-teacher", "2026", "5-1 Step Test"],
            ["__PAPS_SESSION_META", "session-step", "5", "official", "single", "step-test"],
            ["__PAPS_SESSION_STATUS", "session-step", "Y", "2026-03-24T09:10:00.000Z", "", ""],
            ["__PAPS_SESSION_TARGET", "session-step", "demo-class-5-1", "step-test", "0", ""]
          ];
        }

        if (range === "'학생명단'!A2:I1000") {
          return [["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]];
        }

        if (
          range === "'세션기록'!A2:U5000" ||
          range === "'오류로그'!A2:G2000" ||
          range === "'수정로그'!A2:I2000"
        ) {
          return [];
        }

        return [];
      })
    });

    const result = await appendStudentSubmissionToSheet({
      spreadsheetId: "sheet-123",
      sessionId: "session-step",
      studentId: "student-kim",
      detail: {
        kind: "step-test",
        recoveryHeartRates: [50, 50, 49]
      },
      clientSubmissionKey: "submit-step",
      client: stepTestClient
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        attempts: [
          expect.objectContaining({
            measurement: 60.5,
            detail: {
              kind: "step-test",
              recoveryHeartRates: [50, 50, 49]
            }
          })
        ]
      }
    });

    const appendedRow = vi.mocked(stepTestClient.appendRows).mock.calls[0]?.[2]?.[0];
    const appendedNote = String(appendedRow?.at(-1) ?? "");

    expect(appendedRow).toBeDefined();
    expect(appendedNote).toContain("세부기록: 회복심박수 50 / 50 / 49회");
    expect(parseRecordNote(appendedNote)).toMatchObject({
      clientSubmissionKey: "submit-step",
      detail: {
        kind: "step-test",
        recoveryHeartRates: [50, 50, 49]
      }
    });
  });

  it("updates the latest sheet attempt instead of appending a duplicate row", async () => {
    const existingRecordRow = [
      "attempt-1",
      "session-1",
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
      "24",
      "N",
      "",
      "5",
      "2026-03-24 09:00:00",
      "완료",
      "{\"clientSubmissionKey\":\"submit-1\"}"
    ];
    const updateClient = createClient({
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'설정'!A2:F200") {
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

        if (range === "'학생명단'!A2:I1000") {
          return [["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]];
        }

        if (range === "'세션기록'!A2:U5000") {
          return [existingRecordRow];
        }

        if (range === "'오류로그'!A2:G2000" || range === "'수정로그'!A2:I2000") {
          return [];
        }

        return [];
      })
    });

    const result = await updateStudentSubmissionInSheet({
      spreadsheetId: "sheet-123",
      sessionId: "session-1",
      studentId: "student-kim",
      attemptId: "attempt-1",
      measurement: 27,
      clientSubmissionKey: "submit-1",
      client: updateClient
    });

    expect(result).toMatchObject({
      ok: true,
      result: {
        attempts: [
          expect.objectContaining({
            id: "attempt-1",
            measurement: 27
          })
        ]
      }
    });
    expect(updateClient.appendRows).not.toHaveBeenCalledWith(
      "sheet-123",
      "'세션기록'!A:U",
      expect.any(Array)
    );

    const recordUpdateCall = vi
      .mocked(updateClient.updateRange)
      .mock.calls.find((call) => call[1] === "'세션기록'!A1:U5000");
    const updatedRecordRow = recordUpdateCall?.[2].find((row) => row[0] === "attempt-1");

    expect(updatedRecordRow?.[14]).toBe("27");
  });
});
