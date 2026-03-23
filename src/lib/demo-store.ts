import { existsSync } from "node:fs";

import { createDemoStoreSeedData } from "../data/paps/demo";
import { readJsonFile, writeJsonFile } from "./db";
import { getEventDefinition } from "./paps/catalog";
import { assertAttemptInputAllowed, validateSession } from "./paps/validation";
import { resolveStorePath } from "./store-path";
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
} from "./paps/types";

export const PAPS_STORE_PATH_ENV = "PAPS_STORE_PATH";

export interface CreateDemoStoreOptions {
  filePath?: string;
  seedData?: PAPSDemoStoreData;
}

export interface AppendAttemptInput {
  id: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
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

const getRecordId = ({ sessionId, studentId }: RecordSelector): string => `${sessionId}:${studentId}`;

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const cloneStoreData = (data: PAPSDemoStoreData): PAPSDemoStoreData => cloneValue(data);

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

const validateStoreData = (value: unknown): PAPSDemoStoreData => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Demo store data must be a JSON object.");
  }

  const data = value as Partial<PAPSDemoStoreData>;

  if (data.version !== 1) {
    throw new Error(`Unsupported demo store version ${String(data.version)}.`);
  }

  for (const key of REQUIRED_COLLECTION_KEYS) {
    if (!Array.isArray(data[key])) {
      throw new Error(`Demo store data is missing required collection ${key}.`);
    }
  }

  return data as PAPSDemoStoreData;
};

const createAttemptAuditId = (prefix: string, selector: RecordSelector, createdAt: string): string =>
  `${prefix}:${selector.sessionId}:${selector.studentId}:${createdAt}`;

export const createRecordId = ({ sessionId, studentId }: RecordSelector): string =>
  getRecordId({ sessionId, studentId });

export const parseRecordId = (recordId: string): RecordSelector => {
  const [sessionId, studentId] = recordId.split(":");

  if (!sessionId || !studentId) {
    throw new Error(`Record id ${recordId} is invalid.`);
  }

  return {
    sessionId,
    studentId
  };
};

export const createDemoStore = ({ filePath, seedData }: CreateDemoStoreOptions = {}) => {
  const resolvedPath = resolveStorePath(filePath);
  const initialSeed = cloneStoreData(seedData ?? createDemoStoreSeedData());

  const readState = (): PAPSDemoStoreData =>
    validateStoreData(readJsonFile(resolvedPath, cloneStoreData(initialSeed)));

  const writeState = (nextState: PAPSDemoStoreData): PAPSDemoStoreData =>
    writeJsonFile(resolvedPath, nextState);

  const ensureState = (): PAPSDemoStoreData => {
    if (!existsSync(resolvedPath)) {
      return writeState(cloneStoreData(initialSeed));
    }

    return readState();
  };

  const getSession = (sessionId: string): PAPSSession => {
    const session = ensureState().sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} was not found.`);
    }

    return cloneValue(session);
  };

  const getSchool = (schoolId: string): PAPSSchool => {
    const school = ensureState().schools.find((entry) => entry.id === schoolId);

    if (!school) {
      throw new Error(`School ${schoolId} was not found.`);
    }

    return cloneValue(school);
  };

  const getClass = (classId: string): PAPSClassroom => {
    const classroom = ensureState().classes.find((entry) => entry.id === classId);

    if (!classroom) {
      throw new Error(`Class ${classId} was not found.`);
    }

    return cloneValue(classroom);
  };

  const getStudent = (studentId: string): PAPSStudent => {
    const student = ensureState().students.find((entry) => entry.id === studentId);

    if (!student) {
      throw new Error(`Student ${studentId} was not found.`);
    }

    return cloneValue(student);
  };

  const getTeacher = (teacherId: string): PAPSTeacher => {
    const teacher = ensureState().teachers.find((entry) => entry.id === teacherId);

    if (!teacher) {
      throw new Error(`Teacher ${teacherId} was not found.`);
    }

    return cloneValue(teacher);
  };

  const getTeacherByEmail = (email: string): PAPSTeacher | null =>
    cloneValue(
      ensureState().teachers.find(
        (entry) => entry.email.trim().toLowerCase() === email.trim().toLowerCase()
      ) ?? null
    );

  const getAttemptsForRecord = (state: PAPSDemoStoreData, selector: RecordSelector): PAPSStoredAttempt[] =>
    state.attempts
      .filter(
        (attempt) =>
          attempt.sessionId === selector.sessionId && attempt.studentId === selector.studentId
      )
      .sort((left, right) => left.attemptNumber - right.attemptNumber);

  const getRepresentativeAttemptId = (
    state: PAPSDemoStoreData,
    selector: RecordSelector
  ): string | null =>
    state.representativeSelectionAuditLogs
      .filter(
        (entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .at(-1)?.selectedAttemptId ?? null;

  const getAttemptRecord = (selector: RecordSelector): PAPSAttemptRecord => {
    const session = getSession(selector.sessionId);
    getStudent(selector.studentId);
    const state = ensureState();
    const attempts: PAPSAttempt[] = getAttemptsForRecord(state, selector).map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt
    }));

    return cloneValue({
      sessionId: selector.sessionId,
      studentId: selector.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attempts,
      representativeAttemptId: getRepresentativeAttemptId(state, selector)
    });
  };

  const saveSchool = (school: PAPSSchool): PAPSSchool => {
    const state = ensureState();
    const schools = state.schools.filter((entry) => entry.id !== school.id);

    writeState({
      ...state,
      schools: [...schools, school]
    });

    return cloneValue(school);
  };

  const saveClass = (classroom: PAPSClassroom): PAPSClassroom => {
    getSchool(classroom.schoolId);
    const state = ensureState();
    const classes = state.classes.filter((entry) => entry.id !== classroom.id);

    writeState({
      ...state,
      classes: [...classes, classroom]
    });

    return cloneValue(classroom);
  };

  const deleteClass = (classId: string): void => {
    const state = ensureState();

    writeState({
      ...state,
      classes: state.classes.filter((entry) => entry.id !== classId),
      students: state.students.filter((entry) => entry.classId !== classId),
      sessions: state.sessions.filter(
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
    const state = ensureState();
    const students = state.students.filter((entry) => entry.id !== student.id);

    writeState({
      ...state,
      students: [...students, normalizedStudent]
    });

    return cloneValue(normalizedStudent);
  };

  const deleteStudent = (studentId: string): void => {
    const state = ensureState();

    writeState({
      ...state,
      students: state.students.filter((entry) => entry.id !== studentId),
      attempts: state.attempts.filter((entry) => entry.studentId !== studentId),
      syncStatuses: state.syncStatuses.filter((entry) => entry.studentId !== studentId),
      syncErrorLogs: state.syncErrorLogs.filter((entry) => entry.studentId !== studentId),
      representativeSelectionAuditLogs: state.representativeSelectionAuditLogs.filter(
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

    if (normalizedSession.teacherId) {
      getTeacher(normalizedSession.teacherId);
    }

    const state = ensureState();
    const sessions = state.sessions.filter((entry) => entry.id !== normalizedSession.id);

    writeState({
      ...state,
      sessions: [...sessions, normalizedSession]
    });

    return cloneValue(normalizedSession);
  };

  const deleteSession = (sessionId: string): void => {
    const state = ensureState();

    writeState({
      ...state,
      sessions: state.sessions.filter((entry) => entry.id !== sessionId),
      attempts: state.attempts.filter((entry) => entry.sessionId !== sessionId),
      syncStatuses: state.syncStatuses.filter((entry) => entry.sessionId !== sessionId),
      syncErrorLogs: state.syncErrorLogs.filter((entry) => entry.sessionId !== sessionId),
      representativeSelectionAuditLogs: state.representativeSelectionAuditLogs.filter(
        (entry) => entry.sessionId !== sessionId
      )
    });
  };

  const appendAttempt = (input: AppendAttemptInput): PAPSAttemptRecord => {
    const session = getSession(input.sessionId);
    const student = getStudent(input.studentId);
    const state = ensureState();

    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: input.measurement,
        submittedEventId: session.eventId,
        submittedSessionType: session.sessionType
      }
    });

    const attemptsForRecord = getAttemptsForRecord(state, input);
    const storedAttempt: PAPSStoredAttempt = {
      id: input.id,
      sessionId: input.sessionId,
      studentId: input.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attemptNumber: attemptsForRecord.length + 1,
      measurement: input.measurement,
      createdAt: input.createdAt
    };

    writeState({
      ...state,
      attempts: [...state.attempts, storedAttempt]
    });

    return getAttemptRecord(input);
  };

  const selectRepresentativeAttempt = (
    input: SelectRepresentativeAttemptInput
  ): PAPSAttemptRecord => {
    const state = ensureState();
    const record = getAttemptRecord(input);

    if (
      input.attemptId !== null &&
      !record.attempts.some((attempt) => attempt.id === input.attemptId)
    ) {
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
      ...state,
      representativeSelectionAuditLogs: [...state.representativeSelectionAuditLogs, auditLog]
    });

    return getAttemptRecord(input);
  };

  const setSyncStatus = (input: SetSyncStatusInput): PAPSSyncStatusRecord => {
    getSession(input.sessionId);
    getStudent(input.studentId);

    const state = ensureState();
    const syncStatusId = getRecordId(input);
    const nextStatus: PAPSSyncStatusRecord = {
      id: syncStatusId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      status: input.status,
      attemptId: input.attemptId ?? null,
      updatedAt: input.updatedAt
    };
    const syncStatuses = [
      ...state.syncStatuses.filter((entry) => entry.id !== syncStatusId),
      nextStatus
    ];
    const syncErrorLogs = [...state.syncErrorLogs];

    if (input.status === "failed" && input.message) {
      const errorLog: PAPSSyncErrorLog = {
        id: createAttemptAuditId("sync-error", input, input.updatedAt),
        sessionId: input.sessionId,
        studentId: input.studentId,
        syncStatusId,
        message: input.message,
        createdAt: input.updatedAt
      };

      syncErrorLogs.push(errorLog);
    }

    writeState({
      ...state,
      syncStatuses,
      syncErrorLogs
    });

    return cloneValue(nextStatus);
  };

  const getSyncStatus = (selector: RecordSelector): PAPSSyncStatusRecord | null =>
    cloneValue(ensureState().syncStatuses.find((entry) => entry.id === getRecordId(selector)) ?? null);

  const listSyncErrorLogs = (selector?: RecordSelector): PAPSSyncErrorLog[] => {
    const syncErrorLogs = ensureState().syncErrorLogs;

    if (!selector) {
      return cloneValue(syncErrorLogs);
    }

    return cloneValue(syncErrorLogs.filter(
      (entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId
    ));
  };

  const listRepresentativeSelectionAuditLogs = (
    selector?: RecordSelector
  ): PAPSRepresentativeSelectionAuditLog[] => {
    const auditLogs = ensureState().representativeSelectionAuditLogs;

    if (!selector) {
      return cloneValue(auditLogs);
    }

    return cloneValue(auditLogs.filter(
      (entry) => entry.sessionId === selector.sessionId && entry.studentId === selector.studentId
    ));
  };

  const listSessionRecords = (sessionId: string): PAPSAttemptRecord[] => {
    const session = getSession(sessionId);
    const targetedClassIds = new Set(session.classTargets.map((entry) => entry.classId));
    const students = ensureState().students.filter((entry) => targetedClassIds.has(entry.classId));

    return students.map((student) =>
      getAttemptRecord({
        sessionId,
        studentId: student.id
      })
    );
  };

  ensureState();

  return {
    filePath: resolvedPath,
    listSchools: (): PAPSSchool[] => cloneValue(ensureState().schools),
    saveSchool,
    deleteSchool: (schoolId: string): void => {
      const state = ensureState();

      writeState({
        ...state,
        schools: state.schools.filter((entry) => entry.id !== schoolId),
        classes: state.classes.filter((entry) => entry.schoolId !== schoolId),
        students: state.students.filter((entry) => entry.schoolId !== schoolId),
        teachers: state.teachers.filter((entry) => entry.schoolId !== schoolId),
        sessions: state.sessions.filter((entry) => entry.schoolId !== schoolId),
        attempts: state.attempts.filter((entry) =>
          state.sessions.every(
            (session) => session.id !== entry.sessionId || session.schoolId !== schoolId
          )
        ),
        syncStatuses: state.syncStatuses.filter((entry) =>
          state.sessions.every(
            (session) => session.id !== entry.sessionId || session.schoolId !== schoolId
          )
        ),
        syncErrorLogs: state.syncErrorLogs.filter((entry) =>
          state.sessions.every(
            (session) => session.id !== entry.sessionId || session.schoolId !== schoolId
          )
        ),
        representativeSelectionAuditLogs: state.representativeSelectionAuditLogs.filter((entry) =>
          state.sessions.every(
            (session) => session.id !== entry.sessionId || session.schoolId !== schoolId
          )
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
    listRepresentativeSelectionAuditLogs
  };
};

export const getDemoStore = (filePath = process.env[PAPS_STORE_PATH_ENV]) =>
  createDemoStore({
    filePath
  });
