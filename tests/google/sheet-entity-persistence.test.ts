import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GoogleSheetStructuredState } from "../../src/lib/google/sheets-bootstrap";

const {
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
} = vi.hoisted(() => ({
  writeGoogleSheetSettingsSourceTab: vi.fn(async () => undefined),
  writeGoogleSheetStudentsSourceTab: vi.fn(async () => undefined)
}));

vi.mock("../../src/lib/google/sheet-source-write", () => ({
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
}));

import {
  deleteGoogleSheetClass,
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
