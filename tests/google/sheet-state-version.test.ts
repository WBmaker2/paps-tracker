import { describe, expect, it, vi } from "vitest";

import {
  buildTeacherSheetRowsVersion,
  buildTeacherStateVersion,
  readTeacherSheetVersion
} from "../../src/lib/google/sheet-state-version";
import type { TeacherBootstrap } from "../../src/lib/store/paps-store-types";

const createBootstrap = (): TeacherBootstrap => ({
  teacher: {
    id: "teacher-1",
    schoolId: "school-1",
    name: "홍교사",
    email: "teacher@example.com",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z"
  },
  school: {
    id: "school-1",
    name: "테스트 초등학교",
    teacherIds: ["teacher-1"],
    sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
    createdAt: "2026-04-01T09:00:00.000Z",
    updatedAt: "2026-04-01T09:00:00.000Z"
  },
  schools: [
    {
      id: "school-1",
      name: "테스트 초등학교",
      teacherIds: ["teacher-1"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "class-2",
      schoolId: "school-1",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    },
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
      name: "홍교사",
      email: "teacher@example.com",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    }
  ],
  students: [
    {
      id: "student-2",
      schoolId: "school-1",
      classId: "class-2",
      studentNumber: 1,
      name: "김철수",
      sex: "male",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-1",
      schoolId: "school-1",
      classId: "class-1",
      studentNumber: 2,
      name: "이영희",
      sex: "female",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "session-1",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "class-1", eventId: "sit-and-reach" }],
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "5-1 유연성",
      isOpen: true,
      createdAt: "2026-04-01T09:05:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "session-1",
      studentId: "student-1",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 12.3,
      createdAt: "2026-04-01T09:06:00.000Z",
      clientSubmissionKey: "submit-1"
    }
  ],
  syncStatuses: [
    {
      id: "sync-1",
      sessionId: "session-1",
      studentId: "student-1",
      status: "synced",
      attemptId: "attempt-1",
      updatedAt: "2026-04-01T09:07:00.000Z"
    }
  ],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

describe("teacher state version", () => {
  it("stays stable when the same data arrives in a different array order", () => {
    const bootstrap = createBootstrap();
    const reorderedBootstrap = {
      ...bootstrap,
      schools: bootstrap.schools.slice().reverse(),
      classes: bootstrap.classes.slice().reverse(),
      students: bootstrap.students.slice().reverse()
    };

    expect(buildTeacherStateVersion(reorderedBootstrap)).toBe(buildTeacherStateVersion(bootstrap));
  });

  it("changes when visible teacher data changes", () => {
    const bootstrap = createBootstrap();
    const updatedBootstrap = {
      ...bootstrap,
      students: bootstrap.students.map((student) =>
        student.id === "student-1" ? { ...student, name: "이다른이름" } : student
      )
    };

    expect(buildTeacherStateVersion(updatedBootstrap)).not.toBe(buildTeacherStateVersion(bootstrap));
  });

  it("changes when session sync state changes", () => {
    const bootstrap = createBootstrap();
    const updatedBootstrap = {
      ...bootstrap,
      syncStatuses: bootstrap.syncStatuses.map((status) => ({
        ...status,
        status: "failed" as const,
        updatedAt: "2026-04-01T09:10:00.000Z"
      }))
    };

    expect(buildTeacherStateVersion(updatedBootstrap)).not.toBe(buildTeacherStateVersion(bootstrap));
  });

  it("builds the same sheet-row version for identical rows", () => {
    const rowsVersion = buildTeacherSheetRowsVersion({
      settingsRows: [["학교명", "테스트 초등학교"]],
      studentRows: [["student-1", "2026", "5", "1", "1", "김철수", "남", "Y", ""]],
      recordRows: [["attempt-1", "session-1", "student-1"]],
      errorRows: [],
      auditRows: []
    });

    expect(
      buildTeacherSheetRowsVersion({
        settingsRows: [["학교명", "테스트 초등학교"]],
        studentRows: [["student-1", "2026", "5", "1", "1", "김철수", "남", "Y", ""]],
        recordRows: [["attempt-1", "session-1", "student-1"]],
        errorRows: [],
        auditRows: []
      })
    ).toBe(rowsVersion);
  });

  it("marks the sheet disconnected when the teacher email is not authorized in persisted settings", async () => {
    const client = {
      readRanges: vi.fn(async () => [
        [
          ["학교명", "테스트 초등학교", "", "", "", ""],
          ["담당교사 이메일", "teacher@example.com", "", "", "", ""],
          ["__PAPS_SCHOOL", "school-1", "테스트 초등학교", "", "2026-04-01T09:00:00.000Z", "2026-04-01T09:00:00.000Z"],
          ["__PAPS_TEACHER", "teacher-1", "school-1", "홍교사", "teacher@example.com", ""],
          ["__PAPS_TEACHER_META", "teacher-1", "2026-04-01T09:00:00.000Z", "2026-04-01T09:00:00.000Z", "", ""]
        ],
        [],
        [],
        [],
        []
      ])
    };

    await expect(
      readTeacherSheetVersion({
        client: client as never,
        spreadsheetId: "sheet-123",
        teacherEmail: "outsider@example.com"
      })
    ).resolves.toEqual({
      connected: false,
      version: null,
      reason: "teacher_not_authorized"
    });
  });
});
