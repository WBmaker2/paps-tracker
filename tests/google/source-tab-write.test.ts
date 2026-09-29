import { describe, expect, it, vi } from "vitest";

import {
  writeGoogleSheetRecordSourceTab,
  writeGoogleSheetSettingsSourceTab
} from "../../src/lib/google/sheet-source-write";

describe("Google Sheet source-tab writes", () => {
  it("pads the settings tab to the fixed source range", async () => {
    const updateRange = vi.fn(async () => ({}));

    await writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123",
      client: {
        updateRange
      } as never,
      state: {
        school: {
          id: "school-1",
          name: "Alpha Elementary",
          teacherIds: ["teacher-1"],
          sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        },
        classes: [],
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
        sessions: []
      }
    });

    expect(updateRange).toHaveBeenCalledTimes(1);
    expect(updateRange).toHaveBeenCalledWith(
      "sheet-123",
      "'설정'!A1:F200",
      expect.any(Array)
    );
    const values = updateRange.mock.calls[0]?.[2] as string[][];
    expect(values).toHaveLength(200);
    expect(values[0]?.slice(0, 3)).toEqual(["항목", "값", "설명"]);
  });

  it("appends missing record rows while preserving rows absent from the snapshot", async () => {
    const preservedRow = ["legacy-attempt", "old-session", "Historic session"];
    const existingRows = [preservedRow];
    const updateRange = vi.fn(async () => ({}));
    const appendRows = vi.fn(async (_spreadsheetId: string, _range: string, rows: string[][]) => {
      existingRows.push(...rows.map((row) => [...row]));
      return {};
    });
    const readRange = vi.fn(async () => existingRows.map((row) => [...row]));

    await writeGoogleSheetRecordSourceTab({
      spreadsheetId: "sheet-123",
      client: {
        readRange,
        updateRange,
        appendRows
      } as never,
      state: {
        school: {
          id: "school-1",
          name: "Alpha Elementary",
          teacherIds: ["teacher-1"],
          sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        },
        classes: [
          {
            id: "class-1",
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
        allStudents: [
          {
            id: "student-1",
            schoolId: "school-1",
            classId: "class-1",
            studentNumber: 1,
            name: "Kim",
            sex: "female",
            gradeLevel: 5,
            active: true
          }
        ],
        sessions: [
          {
            id: "session-1",
            schoolId: "school-1",
            teacherId: "teacher-1",
            academicYear: 2026,
            name: "Shuttle Run Practice",
            gradeLevel: 5,
            sessionType: "practice",
            classScope: "single",
            eventId: "shuttle-run",
            classTargets: [{ classId: "class-1", eventId: "shuttle-run" }],
            isOpen: false,
            createdAt: "2026-03-23T09:00:00.000Z"
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
            measurement: 31,
            createdAt: "2026-03-23T09:01:00.000Z"
          }
        ],
        syncStatuses: [],
        syncErrorLogs: [],
        representativeSelectionAuditLogs: []
      } as never
    });

    expect(readRange).toHaveBeenCalledWith("sheet-123", "'세션기록'!A2:U5000");
    expect(updateRange).not.toHaveBeenCalledWith(
      "sheet-123",
      "'세션기록'!A1:U5000",
      expect.any(Array)
    );
    expect(appendRows).toHaveBeenCalledWith(
      "sheet-123",
      "'세션기록'!A:U",
      [expect.arrayContaining(["attempt-1", "session-1", "Shuttle Run Practice", "2026"])]
    );
    expect(existingRows[0]).toEqual(preservedRow);
    expect(existingRows).toHaveLength(2);
    expect(existingRows[1]?.[12]).toBe("Kim");
  });
});
