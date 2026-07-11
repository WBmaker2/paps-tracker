import { describe, expect, it, vi } from "vitest";

import type { GoogleSheetStructuredState } from "../../src/lib/google/sheets-bootstrap";
import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";
import { persistStudentSubmissionSummaryRows } from "../../src/lib/google/sheet-summary-row-persistence";

const state: GoogleSheetStructuredState = {
  school: {
    id: "school-1",
    name: "Demo Elementary",
    teacherIds: ["teacher-1"],
    sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
    createdAt: "2026-03-23T09:00:00.000Z",
    updatedAt: "2026-03-23T09:00:00.000Z"
  },
  classes: [
    {
      id: "class-5-1",
      schoolId: "school-1",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    }
  ],
  teachers: [
    {
      id: "teacher-1",
      schoolId: "school-1",
      name: "Teacher",
      email: "teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  hasPersistedTeachers: true,
  sessions: [
    {
      id: "session-1",
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "July Shuttle Run",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
      isOpen: true,
      createdAt: "2026-07-12T00:00:00.000Z"
    }
  ],
  allStudents: [
    {
      id: "student-1",
      schoolId: "school-1",
      classId: "class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "session-1",
      studentId: "student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 1,
      measurement: 35,
      createdAt: "2026-07-12T00:01:00.000Z"
    }
  ],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
};

const createClient = ({
  keyRows,
  recordRows = []
}: {
  keyRows: string[][];
  recordRows?: string[][];
}): GoogleSheetsClient => ({
  getSpreadsheet: vi.fn(async () => ({ spreadsheetId: "sheet-123", sheets: [] })),
  readRange: vi.fn(async (_spreadsheetId, range) => {
    if (range === "'세션기록'!A2:U5000") {
      return recordRows;
    }

    return range === "'학생요약'!A2:E2000" ? keyRows : [];
  }),
  readRanges: vi.fn(async (_spreadsheetId, ranges: string[]) =>
    Promise.all(
      ranges.map((range) => {
        if (range === "'세션기록'!A2:U5000") {
          return recordRows;
        }

        return range === "'학생요약'!A2:E2000" ? keyRows : [];
      })
    )
  ),
  appendRows: vi.fn(async () => ({})),
  updateRange: vi.fn(async () => ({}))
});

describe("student submission summary row persistence", () => {
  it("updates one matching student and event row without rewriting the full summary tab", async () => {
    const client = createClient({
      keyRows: [["student-1", "Kim", "5", "1", "왕복오래달리기"]]
    });

    const result = await persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    expect(result).toEqual({ ok: true, updatedTabs: ["학생요약"] });
    expect(client.updateRange).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A2:L2",
      [expect.arrayContaining(["student-1", "Kim", 35, "laps"])]
    );
    expect(client.updateRange).not.toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A1:L2000",
      expect.any(Array)
    );
    expect(client.appendRows).not.toHaveBeenCalled();
  });

  it("appends one row when the student and event key does not exist", async () => {
    const client = createClient({ keyRows: [] });

    const result = await persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    expect(result).toEqual({ ok: true, updatedTabs: ["학생요약"] });
    expect(client.appendRows).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A:L",
      [expect.arrayContaining(["student-1", "Kim", 35, "laps"])]
    );
  });

  it("deduplicates repeated client submission keys before deriving the summary row", async () => {
    const duplicateState: GoogleSheetStructuredState = {
      ...state,
      attempts: [
        { ...state.attempts[0]!, clientSubmissionKey: "submit-1" },
        {
          ...state.attempts[0]!,
          id: "attempt-duplicate",
          attemptNumber: 2,
          measurement: 99,
          createdAt: "2026-07-12T00:02:00.000Z",
          clientSubmissionKey: "submit-1"
        }
      ]
    };
    const client = createClient({ keyRows: [] });

    await persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state: duplicateState,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    const appendedSummaryRow = vi
      .mocked(client.appendRows)
      .mock.calls.find(([, range]) => range === "'학생요약'!A:L")?.[2][0];

    expect(appendedSummaryRow?.[5]).toBe(35);
    expect(appendedSummaryRow?.[9]).toBe(35);
  });

  it("uses the latest persisted record rows instead of a stale caller snapshot", async () => {
    const client = createClient({
      keyRows: [],
      recordRows: [
        [
          "attempt-1",
          "session-1",
          "July Shuttle Run",
          "2026",
          "2026-07-12",
          "연습",
          "1반형",
          "5-1",
          "1",
          "왕복오래달리기",
          "laps",
          "student-1",
          "Kim",
          "1",
          "35",
          "N",
          "",
          "",
          "2026-07-12 00:01:00",
          "완료",
          '{"clientSubmissionKey":"submit-1"}'
        ],
        [
          "attempt-2",
          "session-1",
          "July Shuttle Run",
          "2026",
          "2026-07-12",
          "연습",
          "1반형",
          "5-1",
          "1",
          "왕복오래달리기",
          "laps",
          "student-1",
          "Kim",
          "2",
          "40",
          "N",
          "",
          "",
          "2026-07-12 00:02:00",
          "완료",
          '{"clientSubmissionKey":"submit-2"}'
        ]
      ]
    });

    await persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    expect(client.appendRows).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A:L",
      [expect.arrayContaining(["student-1", "Kim", 40, "laps"])]
    );
  });

  it("clears duplicate summary rows left by a previous concurrent append", async () => {
    const client = createClient({
      keyRows: [
        ["student-1", "Kim", "5", "1", "왕복오래달리기"],
        ["student-1", "Kim", "5", "1", "왕복오래달리기"]
      ]
    });

    await persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    expect(client.updateRange).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A2:L2",
      [expect.arrayContaining(["student-1", "Kim", 35, "laps"])]
    );
    expect(client.updateRange).toHaveBeenCalledWith(
      "sheet-123",
      "'학생요약'!A3:L3",
      [Array.from({ length: 12 }, () => "")]
    );
  });

  it("serializes summary writes for the same spreadsheet, student, and event", async () => {
    const client = createClient({
      keyRows: [["student-1", "Kim", "5", "1", "왕복오래달리기"]]
    });
    let releaseFirstWrite: (() => void) | undefined;
    const firstWriteBlocked = new Promise<void>((resolve) => {
      releaseFirstWrite = resolve;
    });
    let writeCount = 0;

    client.updateRange = vi.fn(async () => {
      writeCount += 1;

      if (writeCount === 1) {
        await firstWriteBlocked;
      }

      return {};
    });

    const first = persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });
    const second = persistStudentSubmissionSummaryRows({
      spreadsheetId: "sheet-123",
      state,
      sessionId: "session-1",
      studentId: "student-1",
      client
    });

    await vi.waitFor(() => {
      expect(client.readRanges).toHaveBeenCalledTimes(1);
      expect(client.updateRange).toHaveBeenCalledTimes(1);
    });

    releaseFirstWrite?.();
    await Promise.all([first, second]);

    expect(client.readRanges).toHaveBeenCalledTimes(2);
    expect(client.updateRange).toHaveBeenCalledTimes(2);
  });
});
