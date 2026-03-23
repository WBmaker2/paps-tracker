import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDemoStore } from "../../src/lib/demo-store";
import { writeJsonFile } from "../../src/lib/db";
import {
  summarizeRepresentativeRecords,
  summarizeStudentRecord
} from "../../src/lib/paps/summaries";
import type {
  PAPSAttemptRecord,
  PAPSDemoStoreData,
  PAPSSession,
  PAPSSchool,
  PAPSStudent
} from "../../src/lib/paps/types";

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

const tempDirs: string[] = [];

const createTempStorePath = (): string => {
  const tempDir = mkdtempSync(join(tmpdir(), "paps-demo-store-"));
  tempDirs.push(tempDir);

  return join(tempDir, "store.json");
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();

    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }
});

describe("PAPS summaries", () => {
  it("omits grade output for practice sessions", () => {
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

  it("rejects records that do not match the provided session and student context", () => {
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
        student: {
          ...student,
          id: "other-student"
        },
        record
      })
    ).toThrow("Record studentId does not match the provided student.");

    expect(() =>
      summarizeStudentRecord({
        session: {
          ...session,
          eventId: "shuttle-run"
        },
        student,
        record
      })
    ).toThrow("Record eventId does not match the provided session event.");
  });

  it("rejects records whose unit does not match the event definition", () => {
    const session: PAPSSession = {
      id: "official-unit",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-unit",
      studentId: student.id,
      eventId: "sit-and-reach",
      unit: "laps",
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
        session,
        student,
        record
      })
    ).toThrow("Record unit does not match the event definition unit.");
  });

  it("rejects a representative attempt id that does not exist in attempts", () => {
    const session: PAPSSession = {
      id: "official-ghost-rep",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-ghost-rep",
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
      representativeAttemptId: "missing-attempt"
    };

    expect(() =>
      summarizeStudentRecord({
        session,
        student,
        record
      })
    ).toThrow("Representative attempt missing-attempt was not found in the record.");
  });

  it("does not auto-pick a representative when attempts exist", () => {
    const session: PAPSSession = {
      id: "official-2",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-2", eventId: "sit-and-reach" }]
    };
    const record: PAPSAttemptRecord = {
      sessionId: "official-2",
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
      representativeAttemptId: null
    };

    const summary = summarizeStudentRecord({
      session,
      student,
      record
    });

    expect(summary.representativeMeasurement).toBeNull();
    expect(summary.improvement).toBeNull();
    expect(summary).not.toHaveProperty("officialGrade");
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
});

describe("PAPS demo store", () => {
  it("stores multiple attempts for the same student and session", () => {
    const filePath = createTempStorePath();
    const store = createDemoStore({
      filePath,
      seedData: buildStoreSeed()
    });

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

    expect(existsSync(filePath)).toBe(true);
    expect(record?.attempts).toHaveLength(2);
    expect(record?.attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(record?.representativeAttemptId).toBeNull();
  });

  it("updates summaries when a teacher selects a representative attempt", () => {
    const filePath = createTempStorePath();
    const store = createDemoStore({
      filePath,
      seedData: buildStoreSeed()
    });

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

    const firstSummary = summarizeStudentRecord({
      session: store.getSession("official-1"),
      student: store.getStudent("student-1"),
      record: store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      })!
    });

    store.selectRepresentativeAttempt({
      sessionId: "official-1",
      studentId: "student-1",
      attemptId: "attempt-2",
      changedByTeacherId: "teacher-1",
      createdAt: "2026-03-23T09:04:00.000Z"
    });

    const updatedSummary = summarizeStudentRecord({
      session: store.getSession("official-1"),
      student: store.getStudent("student-1"),
      record: store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      })!
    });

    expect(firstSummary.representativeMeasurement).toBe(18);
    expect(updatedSummary.representativeMeasurement).toBe(22);
    expect(updatedSummary.officialGrade).not.toBe(firstSummary.officialGrade);
    expect(
      store.listRepresentativeSelectionAuditLogs({
        sessionId: "official-1",
        studentId: "student-1"
      })
    ).toHaveLength(2);
  });

  it("preserves records when sync status changes to failed", () => {
    const filePath = createTempStorePath();
    const store = createDemoStore({
      filePath,
      seedData: buildStoreSeed()
    });

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

    const record = store.getAttemptRecord({
      sessionId: "official-1",
      studentId: "student-1"
    });

    expect(record?.attempts).toHaveLength(2);
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

  it("persists school and class records across store reloads", () => {
    const filePath = createTempStorePath();
    const store = createDemoStore({
      filePath,
      seedData: buildStoreSeed()
    });
    const school: PAPSSchool = {
      id: "school-2",
      name: "Beta Elementary",
      teacherIds: [],
      sheetUrl: "https://docs.google.com/spreadsheets/d/demo-sheet/edit",
      createdAt: "2026-03-23T09:10:00.000Z",
      updatedAt: "2026-03-23T09:10:00.000Z"
    };

    store.saveSchool(school);
    store.saveClass({
      id: "3-1",
      schoolId: "school-2",
      academicYear: 2026,
      gradeLevel: 3,
      classNumber: 1,
      label: "3-1",
      active: true
    });

    const reloadedStore = createDemoStore({ filePath });

    expect(reloadedStore.listSchools().some((entry) => entry.id === "school-2")).toBe(true);
    expect(reloadedStore.listClasses().some((entry) => entry.id === "3-1")).toBe(true);
  });

  it("surfaces corrupt store JSON with a clear file-specific error", () => {
    const filePath = createTempStorePath();
    writeFileSync(filePath, "{ invalid json", "utf8");

    expect(() => createDemoStore({ filePath }).listSchools()).toThrow(
      `Could not parse JSON store at ${filePath}.`
    );
  });

  it("rejects store data with an unsupported version or missing collections", () => {
    const unsupportedVersionPath = createTempStorePath();
    writeFileSync(unsupportedVersionPath, JSON.stringify({ version: 999, schools: [] }), "utf8");

    expect(() => createDemoStore({ filePath: unsupportedVersionPath }).listSchools()).toThrow(
      "Unsupported demo store version 999."
    );

    const missingCollectionsPath = createTempStorePath();
    writeFileSync(missingCollectionsPath, JSON.stringify({ version: 1, schools: [] }), "utf8");

    expect(() => createDemoStore({ filePath: missingCollectionsPath }).listSchools()).toThrow(
      "Demo store data is missing required collection classes."
    );
  });

  it("returns defensive copies from read APIs", () => {
    const filePath = createTempStorePath();
    const store = createDemoStore({
      filePath,
      seedData: buildStoreSeed()
    });

    const schools = store.listSchools();
    schools[0]!.name = "Mutated School";

    const session = store.getSession("official-1");
    session.name = "Mutated Session";

    const studentRecord = store.getAttemptRecord({
      sessionId: "official-1",
      studentId: "student-1"
    });
    studentRecord.attempts.push({
      id: "ghost-attempt",
      attemptNumber: 99,
      measurement: 999,
      createdAt: "2026-03-23T10:00:00.000Z"
    });

    expect(store.listSchools()[0]?.name).toBe("Alpha Elementary");
    expect(store.getSession("official-1").name).toBe("5-2 Sit And Reach");
    expect(
      store.getAttemptRecord({
        sessionId: "official-1",
        studentId: "student-1"
      }).attempts
    ).toHaveLength(0);
  });
});

describe("JSON store file writes", () => {
  it("uses a unique temp file and leaves an unrelated stale tmp file untouched", () => {
    const filePath = createTempStorePath();
    const staleTemporaryPath = `${filePath}.tmp`;

    writeFileSync(staleTemporaryPath, "stale", "utf8");
    writeJsonFile(filePath, { ok: true });

    expect(readFileSync(staleTemporaryPath, "utf8")).toBe("stale");
    expect(readFileSync(filePath, "utf8")).toContain('"ok": true');
  });
});
