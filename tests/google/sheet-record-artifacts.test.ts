import { describe, expect, it } from "vitest";

import { parseGoogleSheetRecordArtifacts } from "../../src/lib/google/sheet-record-artifacts";
import type { PAPSSession, PAPSTeacher } from "../../src/lib/paps/types";

const sessions: PAPSSession[] = [
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
    isOpen: true,
    createdAt: "2026-03-24T09:00:00.000Z"
  }
];

const teachers: PAPSTeacher[] = [
  {
    id: "teacher-1",
    schoolId: "school-1",
    name: "Demo Teacher",
    email: "demo-teacher@example.com",
    createdAt: "2026-03-24T09:00:00.000Z",
    updatedAt: "2026-03-24T09:00:00.000Z"
  }
];

describe("Google Sheet record artifacts parser", () => {
  it("parses attempts, sync states, errors, and representative audit logs from raw rows", () => {
    const artifacts = parseGoogleSheetRecordArtifacts({
      sessions,
      teachers,
      teacherEmail: "demo-teacher@example.com",
      recordRows: [
        [
          "attempt-1",
          "session-1",
          "Shuttle Run Practice",
          "2026",
          "2026-03-24",
          "practice",
          "1반형",
          "5-1",
          "5-1",
          "Shuttle Run",
          "laps",
          "student-1",
          "Kim",
          "1",
          "31",
          "Y",
          "demo-teacher@example.com",
          "",
          "2026-03-24T09:01:00.000Z",
          "synced",
          ""
        ]
      ],
      errorRows: [
        [
          "2026-03-24T09:02:00.000Z",
          "error",
          "sync",
          "Sheets write failed",
          "attempt-1",
          "",
          ""
        ]
      ],
      auditRows: [
        [
          "2026-03-24T09:01:30.000Z",
          "demo-teacher@example.com",
          "session-1",
          "student-1",
          "Shuttle Run",
          "대표값 선택",
          "",
          "attempt-1",
          "Best lap count"
        ]
      ],
      normalizeIsoValue: (value?: string | null) => {
        if (!value?.trim()) {
          return "2026-03-24T00:00:00.000Z";
        }

        return value.includes("T") ? value : `${value}T00:00:00.000Z`;
      },
      createTeacherId: (email: string) =>
        `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
    });

    expect(artifacts.attempts).toHaveLength(1);
    expect(artifacts.attempts[0]).toMatchObject({
      id: "attempt-1",
      eventId: "shuttle-run",
      measurement: 31
    });
    expect(artifacts.syncStatuses).toEqual([
      expect.objectContaining({
        id: "session-1:student-1",
        status: "synced",
        attemptId: "attempt-1"
      })
    ]);
    expect(artifacts.syncErrorLogs).toEqual([
      expect.objectContaining({
        syncStatusId: "session-1:student-1",
        message: "Sheets write failed"
      })
    ]);
    expect(artifacts.representativeSelectionAuditLogs).toEqual([
      expect.objectContaining({
        sessionId: "session-1",
        studentId: "student-1",
        selectedAttemptId: "attempt-1",
        changedByTeacherId: "teacher-1"
      })
    ]);
  });
});
