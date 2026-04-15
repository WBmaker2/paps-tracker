import { describe, expect, it } from "vitest";

import type { GoogleSheetStructuredState } from "../../src/lib/google/sheets-bootstrap";
import {
  getGoogleSheetClass,
  getGoogleSheetSession,
  getGoogleSheetStudent
} from "../../src/lib/google/sheet-store-queries";

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

describe("Google Sheet store queries", () => {
  it("returns the requested class, student, and session", () => {
    const state = createState();

    expect(getGoogleSheetClass(state, "class-1").label).toBe("5-1");
    expect(getGoogleSheetStudent(state, "student-1").name).toBe("Kim");
    expect(getGoogleSheetSession(state, "session-1").eventId).toBe("shuttle-run");
  });

  it("throws a readable error when an entity is missing", () => {
    const state = createState();

    expect(() => getGoogleSheetClass(state, "missing")).toThrow("Class missing was not found.");
    expect(() => getGoogleSheetStudent(state, "missing")).toThrow("Student missing was not found.");
    expect(() => getGoogleSheetSession(state, "missing")).toThrow("Session missing was not found.");
  });
});
