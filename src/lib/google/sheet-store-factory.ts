import { getGoogleSheetsEnv } from "../env";
import type {
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSSchool,
  PAPSSession,
  PAPSSyncStatusRecord,
  PAPSStudent
} from "../paps/types";
import type {
  RecordSelector,
  SelectRepresentativeAttemptInput,
  SetSyncStatusInput,
  StudentSessionGroupView,
  StudentSessionView,
  TeacherBootstrap
} from "../store/paps-store-types";
import {
  buildStructuredStateFromSheet,
  toTeacherBootstrapFromStructuredState,
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import { GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR } from "./sheet-connection-status";
import {
  deleteGoogleSheetClass,
  deleteGoogleSheetSession,
  deleteGoogleSheetStudent,
  saveGoogleSheetClass,
  saveGoogleSheetSchool,
  saveGoogleSheetSession,
  saveGoogleSheetSessions,
  saveGoogleSheetStudent
} from "./sheet-entity-persistence";
import {
  buildAttemptRecordsForSession,
  getGoogleSheetSyncStatus,
  selectGoogleSheetRepresentativeAttempt,
  setGoogleSheetSyncStatus
} from "./sheet-record-persistence";
import {
  getGoogleSheetClass,
  getGoogleSheetSession,
  getGoogleSheetStudent
} from "./sheet-store-queries";
import type {
  CreateGoogleSheetsStoreForRequestInput,
  TeacherSheetsStore
} from "./sheet-store-types";
import { createGoogleSheetsClient, type GoogleSheetsClient } from "./sheets-client";

export const createGoogleSheetClientFromEnv = (): GoogleSheetsClient => {
  const env = getGoogleSheetsEnv();

  if (!env.serviceAccountEmail || !env.serviceAccountPrivateKey) {
    throw new Error(GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR);
  }

  return createGoogleSheetsClient({
    serviceAccountEmail: env.serviceAccountEmail,
    serviceAccountPrivateKey: env.serviceAccountPrivateKey
  });
};

export const readGoogleSheetState = async (
  input: CreateGoogleSheetsStoreForRequestInput
) =>
  buildStructuredStateFromSheet({
    client: input.client ?? createGoogleSheetClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });

export const createGoogleSheetsStoreForRequest = async (
  input: CreateGoogleSheetsStoreForRequestInput
): Promise<TeacherSheetsStore> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();
  let statePromise: Promise<GoogleSheetStructuredState> | null = null;

  const getState = async () => {
    statePromise ??= readGoogleSheetState({
      ...input,
      client
    });

    return statePromise;
  };

  const getTeacherBootstrap = async ({
    teacherEmail
  }: {
    teacherEmail: string;
  }): Promise<TeacherBootstrap> => toTeacherBootstrapFromStructuredState(await getState(), teacherEmail);

  const saveSchool = async (school: PAPSSchool): Promise<PAPSSchool> => {
    return saveGoogleSheetSchool({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      school
    });
  };

  const getClass = async (classId: string): Promise<PAPSClassroom> => {
    return getGoogleSheetClass(await getState(), classId);
  };

  const saveClass = async (classroom: PAPSClassroom): Promise<PAPSClassroom> => {
    return saveGoogleSheetClass({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      classroom
    });
  };

  const deleteClass = async (classId: string): Promise<void> => {
    await deleteGoogleSheetClass({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      classId
    });
  };

  const getStudent = async (studentId: string): Promise<PAPSStudent> => {
    return getGoogleSheetStudent(await getState(), studentId);
  };

  const saveStudent = async (student: PAPSStudent): Promise<PAPSStudent> => {
    return saveGoogleSheetStudent({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      student
    });
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    await deleteGoogleSheetStudent({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      studentId
    });
  };

  const getSession = async (sessionId: string): Promise<PAPSSession> => {
    return getGoogleSheetSession(await getState(), sessionId);
  };

  const buildStudentSessionView = (
    state: GoogleSheetStructuredState,
    sessionId: string
  ): StudentSessionView => {
    const session = getGoogleSheetSession(state, sessionId);
    const activeStudents = state.allStudents.filter((student) => student.active !== false);

    return {
      session,
      classSections: session.classTargets.map((classTarget) => {
        const classroom = getGoogleSheetClass(state, classTarget.classId);

        return {
          classId: classroom.id,
          label: classroom.label,
          students: activeStudents
            .filter((student) => student.classId === classroom.id)
            .sort((left, right) => {
              if (left.studentNumber !== undefined && right.studentNumber !== undefined) {
                return left.studentNumber - right.studentNumber;
              }

              return left.name.localeCompare(right.name, "en");
            })
            .map((student) => ({
              id: student.id,
              name: student.name
            }))
        };
      })
    };
  };

  const getStudentSessionView = async (sessionId: string): Promise<StudentSessionView> =>
    buildStudentSessionView(await getState(), sessionId);

  const getStudentSessionGroupView = async (
    sessionGroupId: string
  ): Promise<StudentSessionGroupView> => {
    const state = await getState();
    const sessions = state.sessions
      .filter((session) => session.sessionGroupId === sessionGroupId)
      .sort(
        (left, right) =>
          (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
          (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
          left.id.localeCompare(right.id)
      );

    if (sessions.length === 0) {
      throw new Error(`Session group ${sessionGroupId} was not found.`);
    }

    return {
      groupId: sessionGroupId,
      groupName: sessions[0]?.sessionGroupName ?? sessions[0]?.name ?? sessionGroupId,
      sessions: sessions.map((session) => buildStudentSessionView(state, session.id))
    };
  };

  const saveSession = async (session: PAPSSession): Promise<PAPSSession> => {
    return saveGoogleSheetSession({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      session
    });
  };

  const saveSessions = async (sessions: PAPSSession[]): Promise<PAPSSession[]> => {
    return saveGoogleSheetSessions({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      sessions
    });
  };

  const deleteSession = async (sessionId: string): Promise<void> => {
    await deleteGoogleSheetSession({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      sessionId
    });
  };

  const listSessionRecords = async (sessionId: string): Promise<PAPSAttemptRecord[]> =>
    buildAttemptRecordsForSession(await getState(), sessionId);

  const getSyncStatus = async (
    selector: RecordSelector
  ): Promise<PAPSSyncStatusRecord | null> => getGoogleSheetSyncStatus(await getState(), selector);

  const setSyncStatus = async (inputStatus: SetSyncStatusInput): Promise<PAPSSyncStatusRecord> =>
    setGoogleSheetSyncStatus({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      inputStatus
    });

  const selectRepresentativeAttempt = async (
    selection: SelectRepresentativeAttemptInput
  ): Promise<PAPSAttemptRecord> =>
    selectGoogleSheetRepresentativeAttempt({
      client,
      spreadsheetId: input.spreadsheetId,
      state: await getState(),
      selection
    });

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
    saveSessions,
    deleteSession,
    getStudentSessionView,
    getStudentSessionGroupView,
    listSessionRecords,
    selectRepresentativeAttempt,
    getSyncStatus,
    setSyncStatus,
    saveSchool
  };
};
