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
      sessions: state.sessions
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
      sessions: state.sessions
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
      sessions
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
  await writeGoogleSheetStudentsSourceTab({
    client,
    spreadsheetId,
    state: {
      allStudents: state.allStudents.filter((entry) => entry.id !== studentId),
      classes: state.classes
    }
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
      sessions
    }
  });

  return session;
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
  await writeGoogleSheetSettingsSourceTab({
    client,
    spreadsheetId,
    state: {
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions.filter((entry) => entry.id !== sessionId)
    }
  });
};
