import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleSheetStructuredState } from "../../src/lib/google/sheets-bootstrap";

const {
  writeGoogleSheetAuditLogSourceTab,
  writeGoogleSheetErrorLogSourceTab,
  writeGoogleSheetRecordSourceTab
} = vi.hoisted(() => ({
  writeGoogleSheetAuditLogSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetErrorLogSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetRecordSourceTab: vi.fn(async () => undefined)
}));

vi.mock("../../src/lib/google/sheet-source-write", () => ({
  writeGoogleSheetAuditLogSourceTab,
  writeGoogleSheetErrorLogSourceTab,
  writeGoogleSheetRecordSourceTab
}));

import {
  buildAttemptRecordsForSession,
  selectGoogleSheetRepresentativeAttempt,
  setGoogleSheetSyncStatus
} from "../../src/lib/google/sheet-record-persistence";

const createState = (): GoogleSheetStructuredState => ({
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
  hasPersistedTeachers: true,
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
    },
    {
      id: "student-2",
      schoolId: "school-1",
      classId: "class-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
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
      attemptNumber: 2,
      measurement: 33,
      createdAt: "2026-03-23T09:02:00.000Z"
    },
    {
      id: "attempt-0",
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
});

describe("Google Sheet record persistence helpers", () => {
  beforeEach(() => {
    writeGoogleSheetAuditLogSourceTab.mockClear();
    writeGoogleSheetErrorLogSourceTab.mockClear();
    writeGoogleSheetRecordSourceTab.mockClear();
  });

  it("builds session records for all targeted students and sorts attempts", () => {
    const records = buildAttemptRecordsForSession(createState(), "session-1");

    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      studentId: "student-1",
      representativeAttemptId: null
    });
    expect(records[0]?.attempts.map((attempt) => attempt.id)).toEqual(["attempt-0", "attempt-1"]);
    expect(records[1]).toMatchObject({
      studentId: "student-2",
      attempts: []
    });
  });

  it("writes record and error tabs when sync status fails with a message", async () => {
    const nextStatus = await setGoogleSheetSyncStatus({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      inputStatus: {
        sessionId: "session-1",
        studentId: "student-1",
        status: "failed",
        attemptId: "attempt-1",
        updatedAt: "2026-03-23T09:05:00.000Z",
        message: "Sheets write failed"
      }
    });

    expect(nextStatus).toMatchObject({
      id: "session-1:student-1",
      status: "failed",
      attemptId: "attempt-1"
    });
    expect(writeGoogleSheetRecordSourceTab).toHaveBeenCalledTimes(1);
    expect(writeGoogleSheetErrorLogSourceTab).toHaveBeenCalledTimes(1);
  });

  it("writes audit and record tabs when representative attempt changes", async () => {
    const updatedRecord = await selectGoogleSheetRepresentativeAttempt({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      selection: {
        sessionId: "session-1",
        studentId: "student-1",
        attemptId: "attempt-1",
        changedByTeacherId: "teacher-1",
        createdAt: "2026-03-23T09:03:00.000Z",
        reason: "Best lap count"
      }
    });

    expect(updatedRecord.representativeAttemptId).toBe("attempt-1");
    expect(writeGoogleSheetAuditLogSourceTab).toHaveBeenCalledTimes(1);
    expect(writeGoogleSheetRecordSourceTab).toHaveBeenCalledTimes(1);
  });
});
