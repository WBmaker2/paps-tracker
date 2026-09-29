import { describe, expect, it, vi } from "vitest";

import {
  writeGoogleSheetRecordSourceTab,
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
} from "../../src/lib/google/sheet-source-write";

describe("Google Sheet source-tab writes", () => {
  it("writes the complete settings payload to an open-ended range", async () => {
    const updateRange = vi.fn(async () => ({}));
    let persistedRows: string[][] = [];
    const readRange = vi.fn(async () => persistedRows);
    updateRange.mockImplementation(async (_spreadsheetId, _range, values) => {
      persistedRows = values;
      return {};
    });

    await writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123",
      client: {
        updateRange,
        readRange
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
      "'설정'!A:F",
      expect.any(Array)
    );
    const values = updateRange.mock.calls[0]?.[2] as string[][];
    expect(values.length).toBeGreaterThan(0);
    expect(values[0]?.slice(0, 3)).toEqual(["항목", "값", "설명"]);
  });

  it("keeps the existing single-read write contract for student roster tabs", async () => {
    const readRange = vi.fn(async () => [] as string[][]);
    const updateRange = vi.fn(async () => ({}));

    await writeGoogleSheetStudentsSourceTab({
      spreadsheetId: "sheet-123",
      client: { readRange, updateRange } as never,
      state: {
        classes: [],
        allStudents: []
      }
    });

    expect(readRange).toHaveBeenCalledTimes(1);
    expect(readRange).toHaveBeenCalledWith("sheet-123", "'학생명단'!A:I");
    expect(updateRange).toHaveBeenCalledTimes(1);
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

    expect(readRange).toHaveBeenCalledWith("sheet-123", "'세션기록'!A2:U");
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

  it("extends a 200-row settings sheet without truncating the requested rows", async () => {
    const existingRows = Array.from({ length: 200 }, (_, index) => [`legacy-${index}`, "", "", "", "", ""]);
    const updateRange = vi.fn(async () => ({}));
    let writtenRows: string[][] = [];
    const readRange = vi.fn(async () => readRange.mock.calls.length > 1 ? writtenRows : existingRows);
    updateRange.mockImplementation(async (_spreadsheetId, _range, values) => {
      writtenRows = values;
      return {};
    });
    const sessions = Array.from({ length: 38 }, (_, index) => ({
      id: `session-${index}`,
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: `세션 ${index}`,
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "grip-strength",
      classTargets: [],
      isOpen: true,
      createdAt: "2026-09-29T00:00:00.000Z",
      sessionGroupId: `group-${index}`,
      sessionGroupName: `묶음 ${index}`
    }));

    await writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123",
      client: { updateRange, readRange } as never,
      state: {
        school: { id: "school-1", name: "학교", teacherIds: [], sheetUrl: "", createdAt: "", updatedAt: "" },
        classes: ["A", "B"].map((suffix, index) => ({
          id: `class-${suffix}`, schoolId: "school-1", academicYear: 2026, gradeLevel: 5,
          classNumber: index + 1, label: `5-${index + 1}`, active: true
        })), teachers: [], sessions
      }
    });

    expect(readRange).toHaveBeenCalledWith("sheet-123", "'설정'!A:F");
    expect(writtenRows).toHaveLength(208);
  });

  it("round-trips all 208 settings rows after extending the former 200-row boundary", async () => {
    const existingRows = Array.from({ length: 200 }, (_, index) => [`legacy-${index}`, "", "", "", "", ""]);
    let persistedRows: string[][] = [];
    const updateRange = vi.fn(async (_spreadsheetId: string, _range: string, rows: string[][]) => {
      persistedRows = rows.map((row) => [...row]);
      return {};
    });
    const readRange = vi.fn(async () => readRange.mock.calls.length > 1 ? persistedRows : existingRows);
    const sessions = Array.from({ length: 38 }, (_, index) => ({
      id: `session-${index}`, schoolId: "school-1", teacherId: "teacher-1", academicYear: 2026,
      name: `세션 ${index}`, gradeLevel: 5, sessionType: "practice", classScope: "single",
      eventId: "grip-strength", classTargets: [], isOpen: true, createdAt: "2026-09-29T00:00:00.000Z",
      sessionGroupId: `group-${index}`, sessionGroupName: `묶음 ${index}`
    }));

    await writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123", client: { updateRange, readRange } as never,
      state: {
        school: { id: "school-1", name: "학교", teacherIds: [], sheetUrl: "", createdAt: "", updatedAt: "" },
        classes: ["A", "B"].map((suffix, index) => ({
          id: `class-${suffix}`, schoolId: "school-1", academicYear: 2026, gradeLevel: 5,
          classNumber: index + 1, label: `5-${index + 1}`, active: true
        })), teachers: [], sessions
      } as never
    });

    expect(persistedRows).toHaveLength(208);
    expect(persistedRows.filter((row) => row[0] === "__PAPS_SESSION")).toHaveLength(38);
    expect(persistedRows.filter((row) => row[0] === "__PAPS_SESSION_GROUP_ITEM")).toHaveLength(38);
  });

  it("accepts omitted trailing blank rows after a normal settings shrink", async () => {
    const existingRows = Array.from({ length: 208 }, (_, index) => [`old-${index}`, "", "", "", "", ""]);
    let persistedRows: string[][] = [];
    let responseRows: string[][] = [];
    const updateRange = vi.fn(async (_spreadsheetId: string, _range: string, rows: string[][]) => {
      persistedRows = rows;
      return {};
    });
    const readRange = vi.fn(async () => {
      if (readRange.mock.calls.length === 1) return existingRows;
      responseRows = persistedRows.slice(0, persistedRows.findLastIndex((row) => row.some(Boolean)) + 1);
      return responseRows;
    });

    await expect(writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123",
      client: { updateRange, readRange } as never,
      state: {
        school: { id: "school-1", name: "학교", teacherIds: [], sheetUrl: "", createdAt: "", updatedAt: "" },
        classes: [], teachers: [], sessions: []
      }
    })).resolves.toBeUndefined();
    expect(persistedRows).toHaveLength(208);
    expect(responseRows).toHaveLength(persistedRows.findLastIndex((row) => row.some(Boolean)) + 1);
  });

  it("rejects a successful API write when the session target rows are missing on read-back", async () => {
    let reads = 0;
    let persistedRows: string[][] = [];
    const updateRange = vi.fn(async (_spreadsheetId: string, _range: string, rows: string[][]) => {
      persistedRows = rows;
      return {};
    });
    const readRange = vi.fn(async () => {
      reads += 1;
      if (reads === 1) return [];
      return persistedRows.filter((row) => row[0] !== "__PAPS_SESSION_TARGET");
    });

    await expect(writeGoogleSheetSettingsSourceTab({
      spreadsheetId: "sheet-123",
      client: { updateRange, readRange } as never,
      state: {
        school: { id: "school-1", name: "학교", teacherIds: [], sheetUrl: "", createdAt: "", updatedAt: "" },
        classes: [], teachers: [],
        sessions: [{
          id: "wanted-session", schoolId: "school-1", teacherId: "teacher-1", academicYear: 2026,
          name: "악력", gradeLevel: 5, sessionType: "practice", classScope: "single", eventId: "grip-strength",
          classTargets: [{ classId: "class-5", eventId: "grip-strength" }], isOpen: false, createdAt: ""
        }]
      } as never
    })).rejects.toThrow("Google Sheets 설정 write verification failed at row");
  });
});
