import type { NextRequest } from "next/server";

import { getGoogleSheetsEnv } from "../env";
import { createRecordId } from "../paps/record-id";
import { selectRepresentativeAttempt as applyRepresentativeSelection } from "../paps/summaries";
import type {
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord,
  PAPSStudent
} from "../paps/types";
import { createSchoolStoreForRequest, createStoreForRequest } from "../store/paps-store";
import type {
  PapsStore,
  RecordSelector,
  SelectRepresentativeAttemptInput,
  SetSyncStatusInput,
  TeacherBootstrap
} from "../store/paps-store-types";
import {
  buildStructuredStateFromSheet,
  buildTeacherBootstrapFromSheet,
  type GoogleSheetStructuredState,
  toTeacherBootstrapFromStructuredState
} from "./sheets-bootstrap";
import { createGoogleSheetsEditLink } from "./drive-link";
import { createPapsGoogleSheetTabPayloads } from "./sheets";
import { createGoogleSheetsClient, type GoogleSheetsClient } from "./sheets-client";
import { validatePapsGoogleSheetTemplate } from "./sheets-schema";

export const PAPS_SPREADSHEET_ID_COOKIE = "paps-spreadsheet-id";

type MaybePromise<T> = T | Promise<T>;

export interface TeacherSheetsStore {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
  getClass(classId: string): MaybePromise<PAPSClassroom>;
  saveClass(classroom: PAPSClassroom): Promise<PAPSClassroom>;
  deleteClass(classId: string): Promise<void>;
  getStudent(studentId: string): MaybePromise<PAPSStudent>;
  saveStudent(student: PAPSStudent): Promise<PAPSStudent>;
  deleteStudent(studentId: string): Promise<void>;
  getSession(sessionId: string): MaybePromise<PAPSSession>;
  saveSession(session: PAPSSession): Promise<PAPSSession>;
  deleteSession(sessionId: string): Promise<void>;
  listSessionRecords(sessionId: string): MaybePromise<PAPSAttemptRecord[]>;
  selectRepresentativeAttempt(
    input: SelectRepresentativeAttemptInput
  ): MaybePromise<PAPSAttemptRecord>;
  getSyncStatus(selector: RecordSelector): MaybePromise<PAPSSyncStatusRecord | null>;
  setSyncStatus(input: SetSyncStatusInput): MaybePromise<PAPSSyncStatusRecord>;
  saveSchool(school: PAPSSchool): Promise<PAPSSchool>;
}

export type TeacherCrudStore = Awaited<ReturnType<typeof createStoreForRequest>> | TeacherSheetsStore;
export type TeacherSchoolStore =
  | Awaited<ReturnType<typeof createSchoolStoreForRequest>>
  | TeacherSheetsStore;

export interface CreateGoogleSheetsStoreForRequestInput {
  spreadsheetId: string;
  teacherEmail: string;
  client?: GoogleSheetsClient;
}

export interface ConnectTeacherGoogleSheetInput {
  spreadsheetId: string;
  normalizedUrl: string;
  teacherEmail: string;
  teacherName?: string | null;
  schoolName?: string | null;
  client?: GoogleSheetsClient;
}

const GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR =
  "Google Sheets service account environment variables are missing.";

const GOOGLE_SHEET_WRITE_SPECS = {
  설정: { range: "'설정'!A1:F200", rowCount: 200, columnCount: 6 },
  학생명단: { range: "'학생명단'!A1:I1000", rowCount: 1000, columnCount: 9 },
  세션기록: { range: "'세션기록'!A1:U5000", rowCount: 5000, columnCount: 21 },
  학생요약: { range: "'학생요약'!A1:L2000", rowCount: 2000, columnCount: 12 },
  공식평가요약: { range: "'공식평가요약'!A1:K2000", rowCount: 2000, columnCount: 11 },
  오류로그: { range: "'오류로그'!A1:G2000", rowCount: 2000, columnCount: 7 },
  수정로그: { range: "'수정로그'!A1:I2000", rowCount: 2000, columnCount: 9 }
} as const;

const createTimestamp = (): string => new Date().toISOString();

const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const getDisconnectedTeacherBootstrap = (): TeacherBootstrap => ({
  teacher: null,
  school: null,
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

const padRows = (rows: string[][], rowCount: number, columnCount: number): string[][] => {
  const normalizedRows = rows.map((row) => {
    const nextRow = [...row];

    while (nextRow.length < columnCount) {
      nextRow.push("");
    }

    return nextRow.slice(0, columnCount);
  });

  while (normalizedRows.length < rowCount) {
    normalizedRows.push(Array.from({ length: columnCount }, () => ""));
  }

  return normalizedRows.slice(0, rowCount);
};

const createGoogleSheetClientFromEnv = (): GoogleSheetsClient => {
  const env = getGoogleSheetsEnv();

  if (!env.serviceAccountEmail || !env.serviceAccountPrivateKey) {
    throw new Error(GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR);
  }

  return createGoogleSheetsClient({
    serviceAccountEmail: env.serviceAccountEmail,
    serviceAccountPrivateKey: env.serviceAccountPrivateKey
  });
};

const ensureTeacher = (
  teachers: PAPSTeacher[],
  schoolId: string,
  teacherEmail: string
): PAPSTeacher[] => {
  const normalizedEmail = teacherEmail.trim().toLowerCase();

  if (teachers.some((teacher) => teacher.email.trim().toLowerCase() === normalizedEmail)) {
    return teachers;
  }

  const timestamp = createTimestamp();

  return [
    ...teachers,
    {
      id: createTeacherId(teacherEmail),
      schoolId,
      name: teacherEmail.split("@")[0] ?? teacherEmail,
      email: teacherEmail,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  ];
};

const buildAttemptRecordsForSession = (
  state: GoogleSheetStructuredState,
  sessionId: string
): PAPSAttemptRecord[] => {
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  const targetClassIds = new Set(session.classTargets.map((target) => target.classId));
  const latestAuditByRecordId = new Map<string, PAPSRepresentativeSelectionAuditLog>();

  for (const auditLog of state.representativeSelectionAuditLogs) {
    const recordId = createRecordId(auditLog);
    const currentAuditLog = latestAuditByRecordId.get(recordId);

    if (!currentAuditLog || currentAuditLog.createdAt.localeCompare(auditLog.createdAt) <= 0) {
      latestAuditByRecordId.set(recordId, auditLog);
    }
  }

  const recordMap = new Map<string, PAPSAttemptRecord>();
  const targetedStudents = state.allStudents.filter((student) => targetClassIds.has(student.classId));

  for (const student of targetedStudents) {
    recordMap.set(createRecordId({ sessionId, studentId: student.id }), {
      sessionId,
      studentId: student.id,
      eventId: session.eventId,
      unit: state.attempts.find((attempt) => attempt.sessionId === sessionId)?.unit ?? "cm",
      attempts: [],
      representativeAttemptId:
        latestAuditByRecordId.get(createRecordId({ sessionId, studentId: student.id }))?.selectedAttemptId ??
        null
    });
  }

  for (const attempt of state.attempts.filter((entry) => entry.sessionId === sessionId)) {
    const recordId = createRecordId(attempt);
    const record =
      recordMap.get(recordId) ??
      ({
        sessionId,
        studentId: attempt.studentId,
        eventId: attempt.eventId,
        unit: attempt.unit,
        attempts: [],
        representativeAttemptId:
          latestAuditByRecordId.get(recordId)?.selectedAttemptId ?? null
      } satisfies PAPSAttemptRecord);

    record.attempts.push({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt
    });
    recordMap.set(recordId, record);
  }

  return [...recordMap.values()]
    .map((record) => ({
      ...record,
      attempts: [...record.attempts].sort((left, right) => left.attemptNumber - right.attemptNumber),
      representativeAttemptId:
        latestAuditByRecordId.get(createRecordId(record))?.selectedAttemptId ??
        record.representativeAttemptId
    }))
    .sort((left, right) => left.studentId.localeCompare(right.studentId));
};

const persistStructuredState = async (
  input: CreateGoogleSheetsStoreForRequestInput & {
    state: GoogleSheetStructuredState;
  }
): Promise<void> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();
  const payloads = createPapsGoogleSheetTabPayloads({
    school: input.state.school,
    classes: input.state.classes,
    teachers: input.state.teachers,
    students: input.state.allStudents,
    sessions: input.state.sessions,
    attempts: input.state.attempts,
    syncStatuses: input.state.syncStatuses,
    syncErrorLogs: input.state.syncErrorLogs,
    representativeSelectionAuditLogs: input.state.representativeSelectionAuditLogs
  });

  await Promise.all(
    payloads.map((payload) => {
      const spec = GOOGLE_SHEET_WRITE_SPECS[payload.tabName as keyof typeof GOOGLE_SHEET_WRITE_SPECS];

      if (!spec) {
        return Promise.resolve();
      }

      const values = [payload.header, ...payload.rows.map((row) => row.map((cell) => String(cell ?? "")))];

      return client.updateRange(
        input.spreadsheetId,
        spec.range,
        padRows(values, spec.rowCount, spec.columnCount)
      );
    })
  );
};

const readState = async (input: CreateGoogleSheetsStoreForRequestInput) =>
  buildStructuredStateFromSheet({
    client: input.client ?? createGoogleSheetClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });

const resolveStoreWithSpreadsheetId = async <TStore>({
  spreadsheetId,
  teacherEmail,
  testStoreFactory
}: {
  spreadsheetId: string | null | undefined;
  teacherEmail: string;
  testStoreFactory: () => Promise<TStore>;
}): Promise<TStore | TeacherSheetsStore> => {
  if (process.env.NODE_ENV === "test") {
    return testStoreFactory();
  }

  if (!spreadsheetId) {
    throw new Error("Google Sheets is not connected.");
  }

  return createGoogleSheetsStoreForRequest({
    spreadsheetId,
    teacherEmail
  });
};

export const createTeacherRuntimeStoreForRequest = async (
  request: NextRequest,
  teacherEmail: string
): Promise<TeacherCrudStore> =>
  resolveStoreWithSpreadsheetId({
    spreadsheetId: request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null,
    teacherEmail,
    testStoreFactory: createStoreForRequest
  }) as Promise<TeacherCrudStore>;

export const createTeacherSchoolRuntimeStoreForRequest = async (
  request: NextRequest,
  teacherEmail: string
): Promise<TeacherSchoolStore> =>
  resolveStoreWithSpreadsheetId({
    spreadsheetId: request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null,
    teacherEmail,
    testStoreFactory: createSchoolStoreForRequest
  }) as Promise<TeacherSchoolStore>;

export const loadTeacherPageState = async ({
  teacherEmail,
  spreadsheetId
}: {
  teacherEmail: string;
  spreadsheetId: string | null | undefined;
}): Promise<{
  store: TeacherCrudStore | null;
  bootstrap: TeacherBootstrap;
  sheetConnected: boolean;
}> => {
  if (process.env.NODE_ENV === "test") {
    const store = await createStoreForRequest();

    return {
      store,
      bootstrap: await store.getTeacherBootstrap({ teacherEmail }),
      sheetConnected: true
    };
  }

  if (!spreadsheetId) {
    return {
      store: null,
      bootstrap: getDisconnectedTeacherBootstrap(),
      sheetConnected: false
    };
  }

  try {
    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId,
      teacherEmail
    });

    return {
      store,
      bootstrap: await store.getTeacherBootstrap({ teacherEmail }),
      sheetConnected: true
    };
  } catch {
    return {
      store: null,
      bootstrap: getDisconnectedTeacherBootstrap(),
      sheetConnected: false
    };
  }
};

export const connectTeacherGoogleSheet = async (
  input: ConnectTeacherGoogleSheetInput
): Promise<{ school: PAPSSchool; spreadsheetId: string; normalizedUrl: string }> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();
  await validatePapsGoogleSheetTemplate(client, input.spreadsheetId);
  const currentState = await buildStructuredStateFromSheet({
    client,
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });
  const timestamp = createTimestamp();
  const teachers = ensureTeacher(currentState.teachers, currentState.school.id, input.teacherEmail).map(
    (teacher) =>
      teacher.email.trim().toLowerCase() === input.teacherEmail.trim().toLowerCase()
        ? {
            ...teacher,
            name: input.teacherName?.trim() || teacher.name,
            updatedAt: timestamp
          }
        : teacher
  );
  const school: PAPSSchool = {
    ...currentState.school,
    name: input.schoolName?.trim() || currentState.school.name,
    teacherIds: teachers.map((teacher) => teacher.id),
    sheetUrl: input.normalizedUrl,
    updatedAt: timestamp
  };

  await persistStructuredState({
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail,
    client,
    state: {
      ...currentState,
      school,
      teachers
    }
  });

  return {
    school,
    spreadsheetId: input.spreadsheetId,
    normalizedUrl: input.normalizedUrl
  };
};

export const createGoogleSheetsStoreForRequest = async (
  input: CreateGoogleSheetsStoreForRequestInput
): Promise<TeacherSheetsStore> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();
  const saveState = async (state: GoogleSheetStructuredState): Promise<GoogleSheetStructuredState> => {
    await persistStructuredState({
      ...input,
      client,
      state
    });

    return state;
  };

  const getTeacherBootstrap = async ({
    teacherEmail
  }: {
    teacherEmail: string;
  }): Promise<TeacherBootstrap> =>
    buildTeacherBootstrapFromSheet({
      client,
      spreadsheetId: input.spreadsheetId,
      teacherEmail
    });

  const getState = async () =>
    readState({
      ...input,
      client
    });

  const saveSchool = async (school: PAPSSchool): Promise<PAPSSchool> => {
    const state = await getState();
    const nextSchool = {
      ...school,
      teacherIds: ensureTeacher(state.teachers, school.id, input.teacherEmail).map((teacher) => teacher.id),
      sheetUrl: school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      updatedAt: createTimestamp()
    };

    await saveState({
      ...state,
      school: nextSchool
    });

    return nextSchool;
  };

  const getClass = async (classId: string): Promise<PAPSClassroom> => {
    const classroom = (await getState()).classes.find((entry) => entry.id === classId);

    if (!classroom) {
      throw new Error(`Class ${classId} was not found.`);
    }

    return classroom;
  };

  const saveClass = async (classroom: PAPSClassroom): Promise<PAPSClassroom> => {
    const state = await getState();

    await saveState({
      ...state,
      classes: [...state.classes.filter((entry) => entry.id !== classroom.id), classroom]
    });

    return classroom;
  };

  const deleteClass = async (classId: string): Promise<void> => {
    const state = await getState();

    await saveState({
      ...state,
      classes: state.classes.filter((entry) => entry.id !== classId),
      sessions: state.sessions.filter(
        (session) => !session.classTargets.some((classTarget) => classTarget.classId === classId)
      ),
      allStudents: state.allStudents.filter((student) => student.classId !== classId)
    });
  };

  const getStudent = async (studentId: string): Promise<PAPSStudent> => {
    const student = (await getState()).allStudents.find((entry) => entry.id === studentId);

    if (!student) {
      throw new Error(`Student ${studentId} was not found.`);
    }

    return student;
  };

  const saveStudent = async (student: PAPSStudent): Promise<PAPSStudent> => {
    const state = await getState();
    const nextStudent = {
      ...student,
      schoolId: student.schoolId ?? state.school.id
    };

    await saveState({
      ...state,
      allStudents: [...state.allStudents.filter((entry) => entry.id !== nextStudent.id), nextStudent]
    });

    return nextStudent;
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    const state = await getState();

    await saveState({
      ...state,
      allStudents: state.allStudents.filter((entry) => entry.id !== studentId)
    });
  };

  const getSession = async (sessionId: string): Promise<PAPSSession> => {
    const session = (await getState()).sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} was not found.`);
    }

    return session;
  };

  const saveSession = async (session: PAPSSession): Promise<PAPSSession> => {
    const state = await getState();

    await saveState({
      ...state,
      sessions: [...state.sessions.filter((entry) => entry.id !== session.id), session]
    });

    return session;
  };

  const deleteSession = async (sessionId: string): Promise<void> => {
    const state = await getState();

    await saveState({
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

  const listSessionRecords = async (sessionId: string): Promise<PAPSAttemptRecord[]> =>
    buildAttemptRecordsForSession(await getState(), sessionId);

  const getSyncStatus = async (
    selector: RecordSelector
  ): Promise<PAPSSyncStatusRecord | null> => {
    const recordId = createRecordId(selector);

    return (await getState()).syncStatuses.find((entry) => entry.id === recordId) ?? null;
  };

  const setSyncStatus = async (inputStatus: SetSyncStatusInput): Promise<PAPSSyncStatusRecord> => {
    const state = await getState();
    const syncStatusId = createRecordId(inputStatus);
    const nextStatus: PAPSSyncStatusRecord = {
      id: syncStatusId,
      sessionId: inputStatus.sessionId,
      studentId: inputStatus.studentId,
      status: inputStatus.status,
      attemptId: inputStatus.attemptId ?? null,
      updatedAt: inputStatus.updatedAt
    };
    const nextSyncErrorLogs =
      inputStatus.status === "failed" && inputStatus.message
        ? [
            ...state.syncErrorLogs,
            {
              id: `sync-error:${syncStatusId}:${inputStatus.updatedAt}`,
              sessionId: inputStatus.sessionId,
              studentId: inputStatus.studentId,
              syncStatusId,
              message: inputStatus.message,
              createdAt: inputStatus.updatedAt
            } satisfies PAPSSyncErrorLog
          ]
        : state.syncErrorLogs;

    await saveState({
      ...state,
      syncStatuses: [...state.syncStatuses.filter((entry) => entry.id !== syncStatusId), nextStatus],
      syncErrorLogs: nextSyncErrorLogs
    });

    return nextStatus;
  };

  const selectRepresentativeAttempt = async (
    selection: SelectRepresentativeAttemptInput
  ): Promise<PAPSAttemptRecord> => {
    const state = await getState();
    const record = buildAttemptRecordsForSession(state, selection.sessionId).find(
      (entry) => entry.studentId === selection.studentId
    );

    if (!record) {
      throw new Error(
        `Representative record ${selection.sessionId}:${selection.studentId} was not found.`
      );
    }

    const updatedRecord = applyRepresentativeSelection(record, selection.attemptId);
    const session = state.sessions.find((entry) => entry.id === selection.sessionId);

    if (!session) {
      throw new Error(`Session ${selection.sessionId} was not found.`);
    }

    const auditLog: PAPSRepresentativeSelectionAuditLog = {
      id: `rep:${selection.sessionId}:${selection.studentId}:${selection.createdAt}`,
      sessionId: selection.sessionId,
      studentId: selection.studentId,
      eventId: session.eventId,
      previousAttemptId: record.representativeAttemptId,
      selectedAttemptId: selection.attemptId,
      changedByTeacherId: selection.changedByTeacherId,
      reason: selection.reason,
      createdAt: selection.createdAt
    };

    await saveState({
      ...state,
      representativeSelectionAuditLogs: [...state.representativeSelectionAuditLogs, auditLog]
    });

    return updatedRecord;
  };

  return {
    getTeacherBootstrap,
    getClass,
    saveClass,
    deleteClass,
    getStudent,
    saveStudent,
    deleteStudent,
    getSession,
    saveSession,
    deleteSession,
    listSessionRecords,
    selectRepresentativeAttempt,
    getSyncStatus,
    setSyncStatus,
    saveSchool
  };
};

export {
  GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR,
  createGoogleSheetClientFromEnv,
  getDisconnectedTeacherBootstrap
};
