import {
  summarizeRepresentativeRecords,
  summarizeStudentRecord
} from "../../src/lib/paps/summaries";
import type {
  PAPSAttemptRecord,
  PAPSDemoStoreData,
  PAPSSession,
  PAPSStudent
} from "../../src/lib/paps/types";
import { createPapsMemoryStore } from "../../src/lib/store/paps-memory-store";

const student: PAPSStudent = {
  id: "student-1",
  name: "Lee",
  sex: "male",
  gradeLevel: 5,
  classId: "5-2"
};

const buildStoreSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "school-1",
      name: "Alpha Elementary",
      teacherIds: ["teacher-1"],
      sheetUrl: null,
      createdAt: "2026-03-23T08:00:00.000Z",
      updatedAt: "2026-03-23T08:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "5-2",
      schoolId: "school-1",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    }
  ],
  teachers: [
    {
      id: "teacher-1",
      schoolId: "school-1",
      name: "Han Teacher",
      email: "teacher-1@example.com",
      createdAt: "2026-03-23T08:00:00.000Z",
      updatedAt: "2026-03-23T08:00:00.000Z"
    }
  ],
  students: [
    {
      ...student,
      schoolId: "school-1",
      studentNumber: 7,
      active: true
    }
  ],
  sessions: [
    {
      id: "official-1",
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "5-2 Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

describe("PAPS memory store", () => {
  it("stores multiple attempts in order and starts without an auto-selected representative", () => {
    const store = createPapsMemoryStore(buildStoreSeed());

    store.appendAttempt({
      id: "attempt-1",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 18,
      createdAt: "2026-03-23T09:00:00.000Z"
    });
    store.appendAttempt({
      id: "attempt-2",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 22,
      createdAt: "2026-03-23T09:02:00.000Z"
    });

    const record = store.getAttemptRecord({
      sessionId: "official-1",
      studentId: "student-1"
    });

    expect(record.attempts).toHaveLength(2);
    expect(record.attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(record.representativeAttemptId).toBeNull();
  });

  it("updates representative audit history and keeps defensive copies", () => {
    const store = createPapsMemoryStore(buildStoreSeed());

    store.appendAttempt({
      id: "attempt-1",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 18,
      createdAt: "2026-03-23T09:00:00.000Z"
    });
    store.appendAttempt({
      id: "attempt-2",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 22,
      createdAt: "2026-03-23T09:02:00.000Z"
    });

    store.selectRepresentativeAttempt({
      sessionId: "official-1",
      studentId: "student-1",
      attemptId: "attempt-1",
      changedByTeacherId: "teacher-1",
      createdAt: "2026-03-23T09:03:00.000Z"
    });
    store.selectRepresentativeAttempt({
      sessionId: "official-1",
      studentId: "student-1",
      attemptId: "attempt-2",
      changedByTeacherId: "teacher-1",
      createdAt: "2026-03-23T09:04:00.000Z"
    });

    const record = store.getAttemptRecord({
      sessionId: "official-1",
      studentId: "student-1"
    });
    record.attempts.push({
      id: "ghost",
      attemptNumber: 99,
      measurement: 999,
      createdAt: "2026-03-23T10:00:00.000Z"
    });

    expect(
      store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      }).representativeAttemptId
    ).toBe("attempt-2");
    expect(
      store.listRepresentativeSelectionAuditLogs({
        sessionId: "official-1",
        studentId: "student-1"
      })
    ).toHaveLength(2);
    expect(
      store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      }).attempts
    ).toHaveLength(2);
  });

  it("preserves attempts when sync status fails and logs the error", () => {
    const store = createPapsMemoryStore(buildStoreSeed());

    store.appendAttempt({
      id: "attempt-1",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 18,
      createdAt: "2026-03-23T09:00:00.000Z"
    });
    store.appendAttempt({
      id: "attempt-2",
      sessionId: "official-1",
      studentId: "student-1",
      measurement: 22,
      createdAt: "2026-03-23T09:02:00.000Z"
    });

    store.setSyncStatus({
      sessionId: "official-1",
      studentId: "student-1",
      status: "failed",
      updatedAt: "2026-03-23T09:05:00.000Z",
      message: "Google Sheets API unavailable"
    });

    expect(
      store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      }).attempts
    ).toHaveLength(2);
    expect(
      store.getSyncStatus({
        sessionId: "official-1",
        studentId: "student-1"
      })?.status
    ).toBe("failed");
    expect(
      store.listSyncErrorLogs({
        sessionId: "official-1",
        studentId: "student-1"
      })
    ).toHaveLength(1);
  });
});
