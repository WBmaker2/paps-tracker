import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleSheetStructuredState } from "../../src/lib/google/sheets-bootstrap";

const {
  writeGoogleSheetAuditLogSourceTab,
  writeGoogleSheetErrorLogSourceTab,
  writeGoogleSheetRecordSourceTab,
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
} = vi.hoisted(() => ({
  writeGoogleSheetAuditLogSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetErrorLogSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetRecordSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetSettingsSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetStudentsSourceTab: vi.fn(async () => undefined)
}));

vi.mock("../../src/lib/google/sheet-source-write", () => ({
  writeGoogleSheetAuditLogSourceTab,
  writeGoogleSheetErrorLogSourceTab,
  writeGoogleSheetRecordSourceTab,
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
}));

import {
  deleteGoogleSheetClass,
  deleteGoogleSheetStudent,
  deleteGoogleSheetSession,
  saveGoogleSheetSchool,
  saveGoogleSheetSession,
  saveGoogleSheetStudent
} from "../../src/lib/google/sheet-entity-persistence";

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
    }
  ],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

describe("Google Sheet entity persistence helpers", () => {
  beforeEach(() => {
    writeGoogleSheetAuditLogSourceTab.mockClear();
    writeGoogleSheetErrorLogSourceTab.mockClear();
    writeGoogleSheetRecordSourceTab.mockClear();
    writeGoogleSheetSettingsSourceTab.mockClear();
    writeGoogleSheetStudentsSourceTab.mockClear();
  });

  it("fills teacherIds and sheetUrl when saving a school", async () => {
    const savedSchool = await saveGoogleSheetSchool({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      school: {
        id: "school-1",
        name: "Renamed School",
        teacherIds: [],
        sheetUrl: "",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      }
    });

    expect(savedSchool.teacherIds).toEqual(["teacher-1"]);
    expect(savedSchool.sheetUrl).toBe("https://docs.google.com/spreadsheets/d/sheet-123/edit");
    expect(writeGoogleSheetSettingsSourceTab).toHaveBeenCalledTimes(1);
  });

  it("removes dependent sessions and students when deleting a class", async () => {
    await deleteGoogleSheetClass({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      classId: "class-1"
    });

    expect(writeGoogleSheetSettingsSourceTab).toHaveBeenCalledTimes(1);
    expect(writeGoogleSheetStudentsSourceTab).toHaveBeenCalledTimes(1);
    const settingsState = writeGoogleSheetSettingsSourceTab.mock.calls[0]?.[0]?.state;
    const studentsState = writeGoogleSheetStudentsSourceTab.mock.calls[0]?.[0]?.state;

    expect(settingsState.classes).toEqual([]);
    expect(settingsState.sessions).toEqual([]);
    expect(studentsState.allStudents).toEqual([]);
  });

  it("fills schoolId when saving a student", async () => {
    const savedStudent = await saveGoogleSheetStudent({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      student: {
        id: "student-2",
        schoolId: "",
        classId: "class-1",
        studentNumber: 2,
        name: "Lee",
        sex: "male",
        gradeLevel: 5,
        active: true
      }
    });

    expect(savedStudent.schoolId).toBe("school-1");
    expect(writeGoogleSheetStudentsSourceTab).toHaveBeenCalledTimes(1);
  });

  it("removes a deleted student and dependent record rows from Google Sheet source tabs", async () => {
    const state = createState();

    state.attempts = [
      {
        id: "attempt-1",
        sessionId: "session-1",
        studentId: "student-1",
        eventId: "shuttle-run",
        unit: "count",
        attemptNumber: 1,
        measurement: 30,
        createdAt: "2026-03-23T10:00:00.000Z"
      }
    ];
    state.syncStatuses = [
      {
        id: "sync-1",
        sessionId: "session-1",
        studentId: "student-1",
        status: "failed",
        attemptId: "attempt-1",
        updatedAt: "2026-03-23T10:01:00.000Z"
      }
    ];
    state.syncErrorLogs = [
      {
        id: "error-1",
        sessionId: "session-1",
        studentId: "student-1",
        syncStatusId: "sync-1",
        message: "Failed",
        createdAt: "2026-03-23T10:02:00.000Z"
      }
    ];
    state.representativeSelectionAuditLogs = [
      {
        id: "audit-1",
        sessionId: "session-1",
        studentId: "student-1",
        eventId: "shuttle-run",
        previousAttemptId: null,
        selectedAttemptId: "attempt-1",
        changedByTeacherId: "teacher-1",
        createdAt: "2026-03-23T10:03:00.000Z"
      }
    ];

    await deleteGoogleSheetStudent({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state,
      studentId: "student-1"
    });

    const studentsState = writeGoogleSheetStudentsSourceTab.mock.calls[0]?.[0]?.state;
    const recordsState = writeGoogleSheetRecordSourceTab.mock.calls[0]?.[0]?.state;
    const errorsState = writeGoogleSheetErrorLogSourceTab.mock.calls[0]?.[0]?.state;
    const auditsState = writeGoogleSheetAuditLogSourceTab.mock.calls[0]?.[0]?.state;

    expect(studentsState.allStudents).toEqual([]);
    expect(recordsState.attempts).toEqual([]);
    expect(recordsState.syncStatuses).toEqual([]);
    expect(errorsState.syncErrorLogs).toEqual([]);
    expect(auditsState.representativeSelectionAuditLogs).toEqual([]);
  });

  it("writes the settings tab when saving or deleting a session", async () => {
    await saveGoogleSheetSession({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      session: {
        id: "session-2",
        schoolId: "school-1",
        teacherId: "teacher-1",
        academicYear: 2026,
        name: "New Session",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "class-1", eventId: "sit-and-reach" }],
        isOpen: true,
        createdAt: "2026-03-23T10:00:00.000Z"
      }
    });
    await deleteGoogleSheetSession({
      client: {} as never,
      spreadsheetId: "sheet-123",
      state: createState(),
      sessionId: "session-1"
    });

    expect(writeGoogleSheetSettingsSourceTab).toHaveBeenCalledTimes(2);
  });
});
