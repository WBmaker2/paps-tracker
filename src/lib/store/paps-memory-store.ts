import { getEventDefinition } from "../paps/catalog";
import { assertAttemptInputAllowed, validateSession } from "../paps/validation";
import type {
  PAPSAttempt,
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSDemoStoreData,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncState,
  PAPSSyncStatusRecord,
  PAPSStudent,
  PAPSStoredAttempt
} from "../paps/types";

export interface AppendAttemptInput {
  id: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
  detail?: PAPSStoredAttempt["detail"];
}

export interface RecordSelector {
  sessionId: string;
  studentId: string;
}

export interface SelectRepresentativeAttemptInput extends RecordSelector {
  attemptId: string | null;
  changedByTeacherId: string;
  createdAt: string;
  reason?: string;
}

export interface SetSyncStatusInput extends RecordSelector {
  status: PAPSSyncState;
  updatedAt: string;
  message?: string;
  attemptId?: string | null;
}

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

const getRecordId = ({ sessionId, studentId }: RecordSelector): string => `${sessionId}:${studentId}`;

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
  representativeSelectionAuditLogs: []
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

  return cloneValue(data as PAPSDemoStoreData);
};

const createAttemptAuditId = (prefix: string, selector: RecordSelector, createdAt: string): string =>
  `${prefix}:${selector.sessionId}:${selector.studentId}:${createdAt}`;

export const createPapsMemoryStore = (seedData: PAPSDemoStoreData = createDefaultPapsStoreSeed()) => {
  let state = validatePapsStoreData(seedData);

  const readState = (): PAPSDemoStoreData => cloneValue(state);

  const writeState = (nextState: PAPSDemoStoreData): PAPSDemoStoreData => {
    state = validatePapsStoreData(nextState);
    return readState();
  };

  const ensureState = (): PAPSDemoStoreData => readState();

  const getSession = (sessionId: string): PAPSSession => {
    const session = ensureState().sessions.find((entry) => entry.id === sessionId);
    if (!session) throw new Error(`Session ${sessionId} was not found.`);
    return cloneValue(session);
  };

  const getSchool = (schoolId: string): PAPSSchool => {
    const school = ensureState().schools.find((entry) => entry.id === schoolId);
    if (!school) throw new Error(`School ${schoolId} was not found.`);
    return cloneValue(school);
  };

  const getClass = (classId: string): PAPSClassroom => {
    const classroom = ensureState().classes.find((entry) => entry.id === classId);
    if (!classroom) throw new Error(`Class ${classId} was not found.`);
    return cloneValue(classroom);
  };

  const getStudent = (studentId: string): PAPSStudent => {
    const student = ensureState().students.find((entry) => entry.id === studentId);
    if (!student) throw new Error(`Student ${studentId} was not found.`);
    return cloneValue(student);
  };

  const getTeacher = (teacherId: string): PAPSTeacher => {
    const teacher = ensureState().teachers.find((entry) => entry.id === teacherId);
    if (!teacher) throw new Error(`Teacher ${teacherId} was not found.`);
    return cloneValue(teacher);
  };

  const getTeacherByEmail = (email: string): PAPSTeacher | null =>
    cloneValue(
      ensureState().teachers.find(
        (entry) => entry.email.trim().toLowerCase() === email.trim().toLowerCase()
      ) ?? null
    );

  const getAttemptsForRecord = (currentState: PAPSDemoStoreData, selector: RecordSelector): PAPSStoredAttempt[] =>
    currentState.attempts
      .filter((attempt) => attempt.sessionId === selector.sessionId && attempt.studentId === selector.studentId)
      .sort((left, right) => left.attemptNumber - right.attemptNumber);

  const getRepresentativeAttemptId = (currentState: PAPSDemoStoreData, selector: RecordSelector): string | null =>
    currentState.representativeSelectionAuditLogs
      .filter((entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(-1)?.selectedAttemptId ?? null;

  const getAttemptRecord = (selector: RecordSelector): PAPSAttemptRecord => {
    const session = getSession(selector.sessionId);
    getStudent(selector.studentId);
    const currentState = ensureState();
    const attempts: PAPSAttempt[] = getAttemptsForRecord(currentState, selector).map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey,
      detail: attempt.detail ?? null
    }));

    return cloneValue({
      sessionId: selector.sessionId,
      studentId: selector.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attempts,
      representativeAttemptId: getRepresentativeAttemptId(currentState, selector)
    });
  };

  const saveSchool = (school: PAPSSchool): PAPSSchool => {
    const currentState = ensureState();
    writeState({
      ...currentState,
      schools: [...currentState.schools.filter((entry) => entry.id !== school.id), school]
    });
    return cloneValue(school);
  };

  const saveClass = (classroom: PAPSClassroom): PAPSClassroom => {
    getSchool(classroom.schoolId);
    const currentState = ensureState();
    writeState({
      ...currentState,
      classes: [...currentState.classes.filter((entry) => entry.id !== classroom.id), classroom]
    });
    return cloneValue(classroom);
  };

  const deleteClass = (classId: string): void => {
    const currentState = ensureState();
    writeState({
      ...currentState,
      classes: currentState.classes.filter((entry) => entry.id !== classId),
      students: currentState.students.filter((entry) => entry.classId !== classId),
      sessions: currentState.sessions.filter(
        (entry) => !entry.classTargets.some((classTarget) => classTarget.classId === classId)
      )
    });
  };

  const saveStudent = (student: PAPSStudent): PAPSStudent => {
    const classroom = getClass(student.classId);
    if (student.gradeLevel !== classroom.gradeLevel) {
      throw new Error("Student grade must match the selected classroom grade.");
    }
    const normalizedStudent: PAPSStudent = {
      ...student,
      schoolId: student.schoolId ?? classroom.schoolId,
      active: student.active ?? true
    };
    const currentState = ensureState();
    writeState({
      ...currentState,
      students: [...currentState.students.filter((entry) => entry.id !== student.id), normalizedStudent]
    });
    return cloneValue(normalizedStudent);
  };

  const deleteStudent = (studentId: string): void => {
    const currentState = ensureState();
    writeState({
      ...currentState,
      students: currentState.students.filter((entry) => entry.id !== studentId),
      attempts: currentState.attempts.filter((entry) => entry.studentId !== studentId),
      syncStatuses: currentState.syncStatuses.filter((entry) => entry.studentId !== studentId),
      syncErrorLogs: currentState.syncErrorLogs.filter((entry) => entry.studentId !== studentId),
      representativeSelectionAuditLogs: currentState.representativeSelectionAuditLogs.filter(
        (entry) => entry.studentId !== studentId
      )
    });
  };

  const saveSession = (session: PAPSSession): PAPSSession => {
    validateSession(session);
    const normalizedSession: PAPSSession = {
      ...session,
      classTargets: session.classTargets.map((entry) => {
        const classroom = getClass(entry.classId);
        if (classroom.gradeLevel !== session.gradeLevel) {
          throw new Error("Session grade must match the selected class grades.");
        }
        return entry;
      }),
      schoolId: session.schoolId ?? getClass(session.classTargets[0]!.classId).schoolId,
      isOpen: session.isOpen ?? true
    };
    if (normalizedSession.teacherId) getTeacher(normalizedSession.teacherId);
    const currentState = ensureState();
    writeState({
      ...currentState,
      sessions: [...currentState.sessions.filter((entry) => entry.id !== normalizedSession.id), normalizedSession]
    });
    return cloneValue(normalizedSession);
  };

  const deleteSession = (sessionId: string): void => {
    const currentState = ensureState();
    writeState({
      ...currentState,
      sessions: currentState.sessions.filter((entry) => entry.id !== sessionId),
      attempts: currentState.attempts.filter((entry) => entry.sessionId !== sessionId),
      syncStatuses: currentState.syncStatuses.filter((entry) => entry.sessionId !== sessionId),
      syncErrorLogs: currentState.syncErrorLogs.filter((entry) => entry.sessionId !== sessionId),
      representativeSelectionAuditLogs: currentState.representativeSelectionAuditLogs.filter(
        (entry) => entry.sessionId !== sessionId
      )
    });
  };

  const appendAttempt = (input: AppendAttemptInput): PAPSAttemptRecord => {
    const session = getSession(input.sessionId);
    const student = getStudent(input.studentId);
    const currentState = ensureState();
    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: input.measurement,
        submittedEventId: session.eventId,
        submittedSessionType: session.sessionType
      }
    });
    const attemptsForRecord = getAttemptsForRecord(currentState, input);
    const storedAttempt: PAPSStoredAttempt = {
      id: input.id,
      sessionId: input.sessionId,
      studentId: input.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attemptNumber: attemptsForRecord.length + 1,
      measurement: input.measurement,
      createdAt: input.createdAt,
      detail: input.detail ?? null
    };
    writeState({
      ...currentState,
      attempts: [...currentState.attempts, storedAttempt]
    });
    return getAttemptRecord(input);
  };

  const selectRepresentativeAttempt = (input: SelectRepresentativeAttemptInput): PAPSAttemptRecord => {
    const currentState = ensureState();
    const record = getAttemptRecord(input);
    if (input.attemptId !== null && !record.attempts.some((attempt) => attempt.id === input.attemptId)) {
      throw new Error(`Representative attempt ${input.attemptId} was not found in the record.`);
    }
    const session = getSession(input.sessionId);
    const auditLog: PAPSRepresentativeSelectionAuditLog = {
      id: createAttemptAuditId("rep", input, input.createdAt),
      sessionId: input.sessionId,
      studentId: input.studentId,
      eventId: session.eventId,
      previousAttemptId: record.representativeAttemptId,
      selectedAttemptId: input.attemptId,
      changedByTeacherId: input.changedByTeacherId,
      reason: input.reason,
      createdAt: input.createdAt
    };
    writeState({
      ...currentState,
      representativeSelectionAuditLogs: [...currentState.representativeSelectionAuditLogs, auditLog]
    });
    return getAttemptRecord(input);
  };

  const setSyncStatus = (input: SetSyncStatusInput): PAPSSyncStatusRecord => {
    getSession(input.sessionId);
    getStudent(input.studentId);
    const currentState = ensureState();
    const syncStatusId = getRecordId(input);
    const nextStatus: PAPSSyncStatusRecord = {
      id: syncStatusId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      status: input.status,
      attemptId: input.attemptId ?? null,
      updatedAt: input.updatedAt
    };
    const syncStatuses = [...currentState.syncStatuses.filter((entry) => entry.id !== syncStatusId), nextStatus];
    const syncErrorLogs = [...currentState.syncErrorLogs];
    if (input.status === "failed" && input.message) {
      syncErrorLogs.push({
        id: createAttemptAuditId("sync-error", input, input.updatedAt),
        sessionId: input.sessionId,
        studentId: input.studentId,
        syncStatusId,
        message: input.message,
        createdAt: input.updatedAt
      });
    }
    writeState({
      ...currentState,
      syncStatuses,
      syncErrorLogs
    });
    return cloneValue(nextStatus);
  };

  const getSyncStatus = (selector: RecordSelector): PAPSSyncStatusRecord | null =>
    cloneValue(ensureState().syncStatuses.find((entry) => entry.id === getRecordId(selector)) ?? null);

  const listSyncErrorLogs = (selector?: RecordSelector): PAPSSyncErrorLog[] => {
    const syncErrorLogs = ensureState().syncErrorLogs;
    if (!selector) return cloneValue(syncErrorLogs);
    return cloneValue(
      syncErrorLogs.filter((entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId)
    );
  };

  const listRepresentativeSelectionAuditLogs = (selector?: RecordSelector): PAPSRepresentativeSelectionAuditLog[] => {
    const auditLogs = ensureState().representativeSelectionAuditLogs;
    if (!selector) return cloneValue(auditLogs);
    return cloneValue(
      auditLogs.filter((entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId)
    );
  };

  const listSessionRecords = (sessionId: string): PAPSAttemptRecord[] => {
    const session = getSession(sessionId);
    const targetedClassIds = new Set(session.classTargets.map((entry) => entry.classId));
    const students = ensureState().students.filter((entry) => targetedClassIds.has(entry.classId));
    return students.map((student) => getAttemptRecord({ sessionId, studentId: student.id }));
  };

  return {
    listSchools: (): PAPSSchool[] => cloneValue(ensureState().schools),
    saveSchool,
    deleteSchool: (schoolId: string): void => {
      const currentState = ensureState();
      writeState({
        ...currentState,
        schools: currentState.schools.filter((entry) => entry.id !== schoolId),
        classes: currentState.classes.filter((entry) => entry.schoolId !== schoolId),
        students: currentState.students.filter((entry) => entry.schoolId !== schoolId),
        teachers: currentState.teachers.filter((entry) => entry.schoolId !== schoolId),
        sessions: currentState.sessions.filter((entry) => entry.schoolId !== schoolId),
        attempts: currentState.attempts.filter((entry) =>
          currentState.sessions.every((session) => session.id !== entry.sessionId || session.schoolId !== schoolId)
        ),
        syncStatuses: currentState.syncStatuses.filter((entry) =>
          currentState.sessions.every((session) => session.id !== entry.sessionId || session.schoolId !== schoolId)
        ),
        syncErrorLogs: currentState.syncErrorLogs.filter((entry) =>
          currentState.sessions.every((session) => session.id !== entry.sessionId || session.schoolId !== schoolId)
        ),
        representativeSelectionAuditLogs: currentState.representativeSelectionAuditLogs.filter((entry) =>
          currentState.sessions.every((session) => session.id !== entry.sessionId || session.schoolId !== schoolId)
        )
      });
    },
    listClasses: (): PAPSClassroom[] => cloneValue(ensureState().classes),
    saveClass,
    deleteClass,
    listTeachers: (): PAPSTeacher[] => cloneValue(ensureState().teachers),
    getTeacher,
    getTeacherByEmail,
    listStudents: (): PAPSStudent[] => cloneValue(ensureState().students),
    saveStudent,
    deleteStudent,
    listSessions: (): PAPSSession[] => cloneValue(ensureState().sessions),
    saveSession,
    deleteSession,
    getSession,
    getSchool,
    getClass,
    getStudent,
    appendAttempt,
    getAttemptRecord,
    listSessionRecords,
    selectRepresentativeAttempt,
    setSyncStatus,
    getSyncStatus,
    listSyncStatuses: (): PAPSSyncStatusRecord[] => cloneValue(ensureState().syncStatuses),
    listSyncErrorLogs,
    listRepresentativeSelectionAuditLogs,
    seed: (nextSeed: PAPSDemoStoreData) => {
      state = validatePapsStoreData(nextSeed);
    }
  };
};

type PapsMemoryStore = ReturnType<typeof createPapsMemoryStore>;

let requestStore: PapsMemoryStore | null = null;

export const resetRequestStore = (seedData?: PAPSDemoStoreData): PapsMemoryStore => {
  requestStore = createPapsMemoryStore(seedData ?? createDefaultPapsStoreSeed());
  return requestStore;
};

export const seedRequestStore = (seedData: PAPSDemoStoreData): PapsMemoryStore =>
  resetRequestStore(seedData);

export const getRequestStore = (): PapsMemoryStore => {
  if (!requestStore) {
    requestStore = createPapsMemoryStore(
      process.env.NODE_ENV === "test" ? createEmptyPapsStoreData() : createDefaultPapsStoreSeed()
    );
  }

  return requestStore;
};
