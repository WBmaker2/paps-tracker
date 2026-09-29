import type { PAPSDemoStoreData } from "../paps/types";

const DEV_TIMESTAMP = "2026-03-23T09:00:00.000Z";
const REQUIRED_COLLECTION_KEYS = [
  "schools",
  "classes",
  "teachers",
  "students",
  "sessions",
  "attempts",
  "syncStatuses",
  "syncErrorLogs",
  "representativeSelectionAuditLogs"
] as const;
const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const createEmptyPapsStoreData = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [],
  classes: [],
  teachers: [],
  students: [],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: [],
  assessmentRounds: [],
  studentRoundResults: []
});

export const createDefaultPapsStoreSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "도촌초등학교",
      teacherIds: ["demo-teacher"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/demo-paps-sheet/edit",
      createdAt: DEV_TIMESTAMP,
      updatedAt: DEV_TIMESTAMP
    }
  ],
  classes: [
    {
      id: "demo-class-5-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    },
    {
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    }
  ],
  teachers: [
    {
      id: "demo-teacher",
      schoolId: "demo-school",
      name: "Demo Teacher",
      email: "demo-teacher@example.com",
      createdAt: DEV_TIMESTAMP,
      updatedAt: DEV_TIMESTAMP
    }
  ],
  students: [
    {
      id: "demo-student-1",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "김민준",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "demo-student-2",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 2,
      name: "박서연",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "demo-student-3",
      schoolId: "demo-school",
      classId: "demo-class-5-2",
      studentNumber: 1,
      name: "이도윤",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "demo-session-practice",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5학년 1반 셔틀런 연습",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "demo-class-5-1", eventId: "shuttle-run" }],
      isOpen: true,
      createdAt: DEV_TIMESTAMP
    },
    {
      id: "demo-session-split-practice",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5학년 분할형 셔틀런 연습",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "split",
      eventId: "shuttle-run",
      classTargets: [
        { classId: "demo-class-5-1", eventId: "shuttle-run" },
        { classId: "demo-class-5-2", eventId: "shuttle-run" }
      ],
      isOpen: false,
      createdAt: "2026-03-23T10:00:00.000Z"
    },
    {
      id: "demo-session-official",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5학년 2반 앉아윗몸앞으로굽히기 공식평가",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-2", eventId: "sit-and-reach" }],
      isOpen: false,
      createdAt: DEV_TIMESTAMP
    }
  ],
  attempts: [
    {
      id: "demo-attempt-1",
      sessionId: "demo-session-practice",
      studentId: "demo-student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 1,
      measurement: 30,
      createdAt: "2026-03-23T09:05:00.000Z"
    },
    {
      id: "demo-attempt-2",
      sessionId: "demo-session-practice",
      studentId: "demo-student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 2,
      measurement: 33,
      createdAt: "2026-03-23T09:06:00.000Z"
    },
    {
      id: "demo-attempt-3",
      sessionId: "demo-session-split-practice",
      studentId: "demo-student-3",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 1,
      measurement: 35,
      createdAt: "2026-03-23T10:05:00.000Z"
    },
    {
      id: "demo-attempt-4",
      sessionId: "demo-session-official",
      studentId: "demo-student-3",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T11:01:00.000Z"
    },
    {
      id: "demo-attempt-5",
      sessionId: "demo-session-official",
      studentId: "demo-student-3",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 21,
      createdAt: "2026-03-23T11:02:00.000Z"
    }
  ],
  syncStatuses: [
    {
      id: "demo-session-practice:demo-student-1",
      sessionId: "demo-session-practice",
      studentId: "demo-student-1",
      status: "failed",
      attemptId: "demo-attempt-2",
      updatedAt: "2026-03-23T09:07:00.000Z"
    },
    {
      id: "demo-session-official:demo-student-3",
      sessionId: "demo-session-official",
      studentId: "demo-student-3",
      status: "synced",
      attemptId: "demo-attempt-5",
      updatedAt: "2026-03-23T11:04:00.000Z"
    }
  ],
  syncErrorLogs: [
    {
      id: "sync-error:demo-session-practice:demo-student-1:2026-03-23T09:07:00.000Z",
      sessionId: "demo-session-practice",
      studentId: "demo-student-1",
      syncStatusId: "demo-session-practice:demo-student-1",
      message: "Google Sheets 재시도 대기 중",
      createdAt: "2026-03-23T09:07:00.000Z"
    }
  ],
  representativeSelectionAuditLogs: [
    {
      id: "rep:demo-session-official:demo-student-3:2026-03-23T11:03:00.000Z",
      sessionId: "demo-session-official",
      studentId: "demo-student-3",
      eventId: "sit-and-reach",
      previousAttemptId: null,
      selectedAttemptId: "demo-attempt-5",
      changedByTeacherId: "demo-teacher",
      reason: "best-of-two",
      createdAt: "2026-03-23T11:03:00.000Z"
    }
  ]
});

export const validatePapsStoreData = (value: unknown): PAPSDemoStoreData => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("PAPS store data must be a JSON object.");
  }

  const data = value as Partial<PAPSDemoStoreData>;

  if (data.version !== 1) {
    throw new Error(`Unsupported PAPS store version ${String(data.version)}.`);
  }

  for (const key of REQUIRED_COLLECTION_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new Error(`PAPS store data is missing required collection ${key}.`);
    }
  }

  return cloneValue({
    ...(data as PAPSDemoStoreData),
    assessmentRounds: Array.isArray(data.assessmentRounds) ? data.assessmentRounds : [],
    studentRoundResults: Array.isArray(data.studentRoundResults) ? data.studentRoundResults : []
  });
};
