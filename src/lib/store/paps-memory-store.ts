import { getEventDefinition } from "../paps/catalog";
import { assertAttemptInputAllowed, validateSession } from "../paps/validation";
import type {
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
import { createAssessmentRoundMemoryStore } from "./paps-memory-round-store";
import { createRecordReadOperations } from "./paps-memory-record-read";
import type { AppendAttemptInput, RecordSelector, SelectRepresentativeAttemptInput, SetSyncStatusInput, UpdateAttemptInput } from "./paps-memory-store-types";
export type { AppendAttemptInput, RecordSelector, SelectRepresentativeAttemptInput, SetSyncStatusInput, UpdateAttemptInput } from "./paps-memory-store-types";
import { createDefaultPapsStoreSeed, createEmptyPapsStoreData, validatePapsStoreData } from "./paps-memory-store-seed";
export { createDefaultPapsStoreSeed, createEmptyPapsStoreData, validatePapsStoreData } from "./paps-memory-store-seed";
const getRecordId = ({ sessionId, studentId }: RecordSelector): string => `${sessionId}:${studentId}`;

const cloneValue = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

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

  const recordReadOperations = createRecordReadOperations({
    cloneValue,
    ensureState,
    getSession,
    getStudent,
    getAttemptsForRecord,
    getRepresentativeAttemptId
  });
  const { getAttemptRecord, listStudentEventHistory } = recordReadOperations;

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

  const normalizeSession = (session: PAPSSession): PAPSSession => {
    validateSession(session);
    const primaryClassroom = getClass(session.classTargets[0]!.classId);
    const normalizedSession: PAPSSession = {
      ...session,
      classTargets: session.classTargets.map((entry) => {
        getClass(entry.classId);
        return entry;
      }),
      gradeLevel: primaryClassroom.gradeLevel,
      schoolId: session.schoolId ?? primaryClassroom.schoolId,
      isOpen: session.isOpen ?? true
    };
    if (normalizedSession.teacherId) getTeacher(normalizedSession.teacherId);
    return normalizedSession;
  };

  const saveSession = (session: PAPSSession): PAPSSession => {
    const normalizedSession = normalizeSession(session);
    const currentState = ensureState();
    writeState({
      ...currentState,
      sessions: [...currentState.sessions.filter((entry) => entry.id !== normalizedSession.id), normalizedSession]
    });
    return cloneValue(normalizedSession);
  };

  const saveSessions = (sessions: PAPSSession[]): PAPSSession[] => {
    const normalizedSessions = sessions.map(normalizeSession);
    const savedSessionIds = new Set(normalizedSessions.map((session) => session.id));
    const currentState = ensureState();

    writeState({
      ...currentState,
      sessions: [
        ...currentState.sessions.filter((entry) => !savedSessionIds.has(entry.id)),
        ...normalizedSessions
      ]
    });

    return cloneValue(normalizedSessions);
  };

  const replaceSessions = (sessions: PAPSSession[], deleteSessionIds: string[]): PAPSSession[] => {
    const normalized = sessions.map(normalizeSession);
    const replacedIds = new Set([...normalized.map((session) => session.id), ...deleteSessionIds]);
    const current = ensureState();
    writeState({ ...current, sessions: [...current.sessions.filter((entry) => !replacedIds.has(entry.id)), ...normalized] }); return cloneValue(normalized);
  };

  const deleteSessions = (sessionIds: string[]): void => {
    const ids = new Set(sessionIds);
    const currentState = ensureState();
    writeState({
      ...currentState,
      sessions: currentState.sessions.filter((entry) => !ids.has(entry.id)),
      attempts: currentState.attempts.filter((entry) => !ids.has(entry.sessionId)),
      syncStatuses: currentState.syncStatuses.filter((entry) => !ids.has(entry.sessionId)),
      syncErrorLogs: currentState.syncErrorLogs.filter((entry) => !ids.has(entry.sessionId)),
      representativeSelectionAuditLogs: currentState.representativeSelectionAuditLogs.filter(
        (entry) => !ids.has(entry.sessionId)
      )
    });
  };
  const deleteSession = (sessionId: string): void => deleteSessions([sessionId]);

  const appendAttempt = (input: AppendAttemptInput): PAPSAttemptRecord => {
    const session = getSession(input.sessionId);
    const student = getStudent(input.studentId);
    const currentState = ensureState();
    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: input.measurement,
        detail: input.detail ?? null,
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
      clientSubmissionKey: input.clientSubmissionKey?.trim() || undefined,
      detail: input.detail ?? null
    };
    writeState({
      ...currentState,
      attempts: [...currentState.attempts, storedAttempt]
    });
    return getAttemptRecord(input);
  };

  const updateAttempt = (input: UpdateAttemptInput): PAPSAttemptRecord => {
    const session = getSession(input.sessionId);
    const student = getStudent(input.studentId);
    const currentState = ensureState();
    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: input.measurement,
        detail: input.detail ?? null,
        submittedEventId: session.eventId,
        submittedSessionType: session.sessionType
      }
    });

    const attemptsForRecord = getAttemptsForRecord(currentState, input);
    const latestAttempt = attemptsForRecord.at(-1) ?? null;
    const existingAttempt =
      attemptsForRecord.find((attempt) => attempt.id === input.attemptId) ?? null;

    if (!existingAttempt) {
      throw new Error(`Attempt ${input.attemptId} was not found.`);
    }

    if (latestAttempt?.id !== existingAttempt.id) {
      throw new Error("Only the latest attempt can be edited.");
    }

    const clientSubmissionKey = input.clientSubmissionKey?.trim() || null;

    if (
      existingAttempt.clientSubmissionKey &&
      clientSubmissionKey &&
      existingAttempt.clientSubmissionKey !== clientSubmissionKey
    ) {
      throw new Error("Attempt edit token does not match this submission.");
    }

    writeState({
      ...currentState,
      attempts: currentState.attempts.map((attempt) =>
        attempt.id === existingAttempt.id
          ? {
              ...attempt,
              measurement: input.measurement,
              detail: input.detail ?? null,
              clientSubmissionKey: attempt.clientSubmissionKey ?? clientSubmissionKey ?? undefined
            }
          : attempt
      )
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

  const roundStore = createAssessmentRoundMemoryStore({
    initialRounds: ensureState().assessmentRounds,
    initialResults: ensureState().studentRoundResults,
    listSessions: () => ensureState().sessions,
    listStudents: () => ensureState().students,
    getClass,
    listSessionRecords,
    saveSessions,
    onChange: (assessmentRounds, studentRoundResults) => {
      const currentState = ensureState();
      writeState({ ...currentState, assessmentRounds, studentRoundResults });
    }
  });

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
    saveSessions,
    replaceSessions,
    deleteSession,
    deleteSessions,
    getSession,
    getSchool,
    getClass,
    getStudent,
    appendAttempt,
    updateAttempt,
    getAttemptRecord,
    listSessionRecords,
    listStudentEventHistory,
    selectRepresentativeAttempt,
    setSyncStatus,
    getSyncStatus,
    listSyncStatuses: (): PAPSSyncStatusRecord[] => cloneValue(ensureState().syncStatuses),
    listSyncErrorLogs,
    listRepresentativeSelectionAuditLogs,
    ...roundStore,
    seed: (nextSeed: PAPSDemoStoreData) => {
      state = validatePapsStoreData(nextSeed);
      roundStore.replaceAssessmentRoundData(state.assessmentRounds ?? [], state.studentRoundResults ?? []);
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
