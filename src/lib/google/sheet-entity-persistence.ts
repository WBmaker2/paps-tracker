import type {
  PAPSClassroom,
  PAPSSchool,
  PAPSSession,
  PAPSStudent
} from "../paps/types";
import type { GoogleSheetStructuredState } from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import {
  writeGoogleSheetSettingsSourceTab,
  writeGoogleSheetStudentsSourceTab
} from "./sheet-source-write";
import { createGoogleSheetsEditLink } from "./drive-link";

const createTimestamp = (): string => new Date().toISOString();

export const saveGoogleSheetSchool = async ({
  client,
  spreadsheetId,
  state,
  school
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  school: PAPSSchool;
}): Promise<PAPSSchool> => {
  const nextSchool = {
    ...school,
    teacherIds: state.teachers.map((teacher) => teacher.id),
    sheetUrl: school.sheetUrl || createGoogleSheetsEditLink(spreadsheetId),
    updatedAt: createTimestamp()
  };

  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: nextSchool,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions,
      assessmentRounds: state.assessmentRounds
    }
  });

  return nextSchool;
};

export const saveGoogleSheetClass = async ({
  client,
  spreadsheetId,
  state,
  classroom
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  classroom: PAPSClassroom;
}): Promise<PAPSClassroom> => {
  const classes = [...state.classes.filter((entry) => entry.id !== classroom.id), classroom];

  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes,
      teachers: state.teachers,
      sessions: state.sessions,
      assessmentRounds: state.assessmentRounds
    }
  });
  await writeGoogleSheetStudentsSourceTab({
    client,
    spreadsheetId,
    state: {
      allStudents: state.allStudents,
      classes
    }
  });

  return classroom;
};

export const deleteGoogleSheetClass = async ({
  client,
  spreadsheetId,
  state,
  classId
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  classId: string;
}): Promise<void> => {
  const classes = state.classes.filter((entry) => entry.id !== classId);
  const sessions = state.sessions.filter(
    (session) => !session.classTargets.some((classTarget) => classTarget.classId === classId)
  );
  const allStudents = state.allStudents.filter((student) => student.classId !== classId);

  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes,
      teachers: state.teachers,
      sessions,
      assessmentRounds: state.assessmentRounds
    }
  });
  await writeGoogleSheetStudentsSourceTab({
    client,
    spreadsheetId,
    state: {
      allStudents,
      classes
    }
  });
};

export const saveGoogleSheetStudent = async ({
  client,
  spreadsheetId,
  state,
  student
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  student: PAPSStudent;
}): Promise<PAPSStudent> => {
  const nextStudent = {
    ...student,
    schoolId: student.schoolId || state.school.id
  };
  const allStudents = [...state.allStudents.filter((entry) => entry.id !== nextStudent.id), nextStudent];

  await writeGoogleSheetStudentsSourceTab({
    client,
    spreadsheetId,
    state: {
      allStudents,
      classes: state.classes
    }
  });

  return nextStudent;
};

export const deleteGoogleSheetStudent = async ({
  client,
  spreadsheetId,
  state,
  studentId
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  studentId: string;
}): Promise<void> => {
  const student = state.allStudents.find((entry) => entry.id === studentId);
  if (!student) return;

  // Archive only the roster row. Measurement and audit tabs are append/source data and must remain untouched.
  await saveGoogleSheetStudent({
    client,
    spreadsheetId,
    state,
    student: { ...student, active: false }
  });
};

export const saveGoogleSheetSession = async ({
  client,
  spreadsheetId,
  state,
  session
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  session: PAPSSession;
}): Promise<PAPSSession> => {
  const sessions = [...state.sessions.filter((entry) => entry.id !== session.id), session];

  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions,
      assessmentRounds: state.assessmentRounds
    }
  });

  return session;
};

export const saveGoogleSheetSessions = async ({
  client,
  spreadsheetId,
  state,
  sessions: nextSessions
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  sessions: PAPSSession[];
}): Promise<PAPSSession[]> => {
  return replaceGoogleSheetSessions({ client, spreadsheetId, state, sessions: nextSessions, deleteSessionIds: [] });
};

export const replaceGoogleSheetSessions = async ({ client, spreadsheetId, state, sessions: nextSessions, deleteSessionIds }: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  sessions: PAPSSession[];
  deleteSessionIds: string[];
}): Promise<PAPSSession[]> => {
  const replacedIds = new Set([...nextSessions.map((session) => session.id), ...deleteSessionIds]);
  const sessions = [...state.sessions.filter((entry) => !replacedIds.has(entry.id)), ...nextSessions];

  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions,
      assessmentRounds: state.assessmentRounds
    }
  });

  return nextSessions;
};

export const deleteGoogleSheetSession = async ({
  client,
  spreadsheetId,
  state,
  sessionId
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  sessionId: string;
}): Promise<void> => {
  await deleteGoogleSheetSessions({ client, spreadsheetId, state, sessionIds: [sessionId] });
};

export const deleteGoogleSheetSessions = async ({
  client,
  spreadsheetId,
  state,
  sessionIds
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  sessionIds: string[];
}): Promise<void> => {
  const ids = new Set(sessionIds);
  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions.filter((entry) => !ids.has(entry.id)),
      assessmentRounds: state.assessmentRounds
    }
  });
};
