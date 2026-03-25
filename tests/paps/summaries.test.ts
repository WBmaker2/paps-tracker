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

describe("PAPS summaries", () => {
  it("omits official grade output for practice sessions", () => {
    const session: PAPSSession = {
      id: "practice-1",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "5-2", eventId: "shuttle-run" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "practice-1",
      studentId: student.id,
      eventId: "shuttle-run",
      unit: "laps",
      attempts: [
        {
          id: "attempt-1",
          attemptNumber: 1,
          measurement: 34,
          createdAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      representativeAttemptId: "attempt-1"
    };

    const summary = summarizeStudentRecord({
      session,
      student,
      record,
      previousRepresentativeMeasurement: 30
    });

    expect(summary.representativeMeasurement).toBe(34);
    expect(summary.improvement).toBe(4);
    expect(summary).not.toHaveProperty("officialGrade");
  });

  it("uses the teacher-selected representative for official grade calculation", () => {
    const session: PAPSSession = {
      id: "official-1",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-1",
      studentId: student.id,
      eventId: "sit-and-reach",
      unit: "cm",
      attempts: [
        {
          id: "attempt-1",
          attemptNumber: 1,
          measurement: 18,
          createdAt: "2026-03-23T09:00:00.000Z"
        },
        {
          id: "attempt-2",
          attemptNumber: 2,
          measurement: 22,
          createdAt: "2026-03-23T09:02:00.000Z"
        }
      ],
      representativeAttemptId: "attempt-1"
    };

    const summary = summarizeStudentRecord({
      session,
      student,
      record
    });

    expect(summary.representativeMeasurement).toBe(18);
    expect(summary.officialGrade).toBe(4);
  });

  it("uses the session grade context instead of the student's current grade snapshot", () => {
    const session: PAPSSession = {
      id: "official-1b",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const advancedStudent: PAPSStudent = {
      ...student,
      gradeLevel: 6
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-1b",
      studentId: advancedStudent.id,
      eventId: "sit-and-reach",
      unit: "cm",
      attempts: [
        {
          id: "attempt-1",
          attemptNumber: 1,
          measurement: 17,
          createdAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      representativeAttemptId: "attempt-1"
    };

    const summary = summarizeStudentRecord({
      session,
      student: advancedStudent,
      record
    });

    expect(summary.officialGrade).toBe(4);
  });

  it("rejects mismatched context, bad units, and missing representative attempts", () => {
    const session: PAPSSession = {
      id: "official-ctx",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-ctx",
      studentId: student.id,
      eventId: "sit-and-reach",
      unit: "cm",
      attempts: [
        {
          id: "attempt-1",
          attemptNumber: 1,
          measurement: 18,
          createdAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      representativeAttemptId: "attempt-1"
    };

    expect(() =>
      summarizeStudentRecord({
        session: {
          ...session,
          id: "other-session"
        },
        student,
        record
      })
    ).toThrow("Record sessionId does not match the provided session.");

    expect(() =>
      summarizeStudentRecord({
        session,
        student,
        record: {
          ...record,
          unit: "laps"
        }
      })
    ).toThrow("Record unit does not match the event definition unit.");

    expect(() =>
      summarizeStudentRecord({
        session,
        student,
        record: {
          ...record,
          representativeAttemptId: "missing-attempt"
        }
      })
    ).toThrow("Representative attempt missing-attempt was not found in the record.");
  });

  it("aggregates student and official summaries from representative selections", () => {
    const sessions: PAPSSession[] = [
      {
        id: "practice-1",
        name: "Practice A",
        gradeLevel: 5,
        sessionType: "practice",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
        createdAt: "2026-03-23T09:00:00.000Z"
      },
      {
        id: "practice-2",
        name: "Practice B",
        gradeLevel: 5,
        sessionType: "practice",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
        createdAt: "2026-03-23T10:00:00.000Z"
      },
      {
        id: "official-1",
        name: "Official A",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
        createdAt: "2026-03-23T11:00:00.000Z"
      }
    ];
    const records: PAPSAttemptRecord[] = [
      {
        sessionId: "practice-1",
        studentId: student.id,
        eventId: "sit-and-reach",
        unit: "cm",
        attempts: [
          {
            id: "attempt-1",
            attemptNumber: 1,
            measurement: 18,
            createdAt: "2026-03-23T09:01:00.000Z"
          }
        ],
        representativeAttemptId: "attempt-1"
      },
      {
        sessionId: "practice-2",
        studentId: student.id,
        eventId: "sit-and-reach",
        unit: "cm",
        attempts: [
          {
            id: "attempt-2",
            attemptNumber: 1,
            measurement: 22,
            createdAt: "2026-03-23T10:01:00.000Z"
          }
        ],
        representativeAttemptId: "attempt-2"
      },
      {
        sessionId: "official-1",
        studentId: student.id,
        eventId: "sit-and-reach",
        unit: "cm",
        attempts: [
          {
            id: "attempt-3",
            attemptNumber: 1,
            measurement: 21,
            createdAt: "2026-03-23T11:01:00.000Z"
          }
        ],
        representativeAttemptId: "attempt-3"
      }
    ];

    const summaries = summarizeRepresentativeRecords({
      students: [student],
      sessions,
      records
    });

    expect(summaries.studentSummaries).toEqual([
      expect.objectContaining({
        studentId: "student-1",
        eventId: "sit-and-reach",
        latestRepresentativeMeasurement: 21,
        previousRepresentativeMeasurement: 22,
        improvement: -1,
        bestRepresentativeMeasurement: 22,
        latestSessionId: "official-1",
        message: "공식 기록 완료"
      })
    ]);
    expect(summaries.officialSummaries).toEqual([
      expect.objectContaining({
        studentId: "student-1",
        eventId: "sit-and-reach",
        representativeMeasurement: 21,
        officialGrade: 3,
        sessionId: "official-1",
        note: "공식 기록 완료"
      })
    ]);
  });

  it("builds student summaries from the latest attempt when no representative is selected yet", () => {
    const sessions: PAPSSession[] = [
      {
        id: "practice-1",
        name: "Practice A",
        gradeLevel: 5,
        sessionType: "practice",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
        createdAt: "2026-03-23T09:00:00.000Z"
      },
      {
        id: "practice-2",
        name: "Practice B",
        gradeLevel: 5,
        sessionType: "practice",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }],
        createdAt: "2026-03-23T10:00:00.000Z"
      }
    ];
    const records: PAPSAttemptRecord[] = [
      {
        sessionId: "practice-1",
        studentId: student.id,
        eventId: "sit-and-reach",
        unit: "cm",
        attempts: [
          {
            id: "attempt-1",
            attemptNumber: 1,
            measurement: 18,
            createdAt: "2026-03-23T09:01:00.000Z"
          }
        ],
        representativeAttemptId: null
      },
      {
        sessionId: "practice-2",
        studentId: student.id,
        eventId: "sit-and-reach",
        unit: "cm",
        attempts: [
          {
            id: "attempt-2",
            attemptNumber: 1,
            measurement: 21,
            createdAt: "2026-03-23T10:01:00.000Z"
          }
        ],
        representativeAttemptId: null
      }
    ];

    const summaries = summarizeRepresentativeRecords({
      students: [student],
      sessions,
      records
    });

    expect(summaries.studentSummaries).toEqual([
      expect.objectContaining({
        studentId: "student-1",
        latestRepresentativeMeasurement: 21,
        previousRepresentativeMeasurement: 18,
        improvement: 3,
        bestRepresentativeMeasurement: 21,
        message: "지난 기록 대비 +3cm"
      })
    ]);
    expect(summaries.officialSummaries).toEqual([]);
  });
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
