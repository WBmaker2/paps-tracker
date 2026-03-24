import { getGoogleSheetsEnv } from "../env";
import { createGoogleSheetsEditLink } from "./drive-link";
import { buildSettingsTabValues, buildStudentTabValues, buildStructuredStateFromSheet, buildTeacherBootstrapFromSheet } from "./sheets-bootstrap";
import { createGoogleSheetsClient, type GoogleSheetsClient } from "./sheets-client";
import { validatePapsGoogleSheetTemplate } from "./sheets-schema";
import type {
  PAPSClassroom,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSStudent
} from "../paps/types";
import type { PapsStore, SchoolStore, TeacherBootstrap } from "../store/paps-store-types";

export const PAPS_SPREADSHEET_ID_COOKIE = "paps-spreadsheet-id";

type TeacherSheetsStore = Pick<
  PapsStore,
  | "getTeacherBootstrap"
  | "getClass"
  | "saveClass"
  | "deleteClass"
  | "getStudent"
  | "saveStudent"
  | "deleteStudent"
  | "getSession"
  | "saveSession"
  | "deleteSession"
> &
  Pick<SchoolStore, "saveSchool">;

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

const SETTINGS_WRITE_RANGE = "'설정'!A1:F200";
const STUDENTS_WRITE_RANGE = "'학생명단'!A1:I1000";

const createClientFromEnv = (): GoogleSheetsClient => {
  const env = getGoogleSheetsEnv();

  if (!env.serviceAccountEmail || !env.serviceAccountPrivateKey) {
    throw new Error("Google Sheets service account environment variables are missing.");
  }

  return createGoogleSheetsClient({
    serviceAccountEmail: env.serviceAccountEmail,
    serviceAccountPrivateKey: env.serviceAccountPrivateKey
  });
};

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

const createTimestamp = (): string => new Date().toISOString();

const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const readState = async (input: CreateGoogleSheetsStoreForRequestInput) =>
  buildStructuredStateFromSheet({
    client: input.client ?? createClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });

const persistState = async (
  input: CreateGoogleSheetsStoreForRequestInput & {
    school: PAPSSchool;
    classes: PAPSClassroom[];
    teachers: PAPSTeacher[];
    sessions: PAPSSession[];
    students: PAPSStudent[];
  }
): Promise<void> => {
  const client = input.client ?? createClientFromEnv();
  const settingsValues = padRows(
    buildSettingsTabValues({
      spreadsheetId: input.spreadsheetId,
      school: input.school,
      classes: input.classes,
      teachers: input.teachers,
      sessions: input.sessions
    }),
    200,
    6
  );
  const studentValues = padRows(
    buildStudentTabValues({
      students: input.students,
      classes: input.classes
    }),
    1000,
    9
  );

  await Promise.all([
    client.updateRange(input.spreadsheetId, SETTINGS_WRITE_RANGE, settingsValues),
    client.updateRange(input.spreadsheetId, STUDENTS_WRITE_RANGE, studentValues)
  ]);
};

const ensureTeacher = (teachers: PAPSTeacher[], schoolId: string, teacherEmail: string): PAPSTeacher[] => {
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

export const connectTeacherGoogleSheet = async (
  input: ConnectTeacherGoogleSheetInput
): Promise<{ school: PAPSSchool; spreadsheetId: string; normalizedUrl: string }> => {
  const client = input.client ?? createClientFromEnv();
  await validatePapsGoogleSheetTemplate(client, input.spreadsheetId);
  const currentState = await buildStructuredStateFromSheet({
    client,
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });
  const timestamp = createTimestamp();
  const school: PAPSSchool = {
    ...currentState.school,
    name: input.schoolName?.trim() || currentState.school.name,
    sheetUrl: input.normalizedUrl,
    updatedAt: timestamp
  };
  const teachers = ensureTeacher(currentState.teachers, school.id, input.teacherEmail).map((teacher) =>
    teacher.email.trim().toLowerCase() === input.teacherEmail.trim().toLowerCase()
      ? {
          ...teacher,
          name: input.teacherName?.trim() || teacher.name,
          updatedAt: timestamp
        }
      : teacher
  );

  await persistState({
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail,
    client,
    school,
    classes: currentState.classes,
    teachers,
    sessions: currentState.sessions,
    students: currentState.allStudents
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
  const client = input.client ?? createClientFromEnv();
  const getTeacherBootstrap = async ({ teacherEmail }: { teacherEmail: string }): Promise<TeacherBootstrap> =>
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
      sheetUrl: school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      updatedAt: createTimestamp()
    };

    await persistState({
      ...input,
      client,
      school: nextSchool,
      classes: state.classes,
      teachers: ensureTeacher(state.teachers, nextSchool.id, input.teacherEmail),
      sessions: state.sessions,
      students: state.allStudents
    });

    return nextSchool;
  };

  const getClass = async (classId: string): Promise<PAPSClassroom> => {
    const state = await getState();
    const classroom = state.classes.find((entry) => entry.id === classId);

    if (!classroom) {
      throw new Error(`Class ${classId} was not found.`);
    }

    return classroom;
  };

  const saveClass = async (classroom: PAPSClassroom): Promise<PAPSClassroom> => {
    const state = await getState();
    const classes = [...state.classes.filter((entry) => entry.id !== classroom.id), classroom];

    await persistState({
      ...input,
      client,
      school: state.school,
      classes,
      teachers: state.teachers,
      sessions: state.sessions,
      students: state.allStudents
    });

    return classroom;
  };

  const deleteClass = async (classId: string): Promise<void> => {
    const state = await getState();

    await persistState({
      ...input,
      client,
      school: state.school,
      classes: state.classes.filter((entry) => entry.id !== classId),
      teachers: state.teachers,
      sessions: state.sessions.filter(
        (session) => !session.classTargets.some((classTarget) => classTarget.classId === classId)
      ),
      students: state.allStudents.filter((student) => student.classId !== classId)
    });
  };

  const getStudent = async (studentId: string): Promise<PAPSStudent> => {
    const state = await getState();
    const student = state.allStudents.find((entry) => entry.id === studentId);

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

    await persistState({
      ...input,
      client,
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions,
      students: [...state.allStudents.filter((entry) => entry.id !== nextStudent.id), nextStudent]
    });

    return nextStudent;
  };

  const deleteStudent = async (studentId: string): Promise<void> => {
    const state = await getState();

    await persistState({
      ...input,
      client,
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions,
      students: state.allStudents.filter((entry) => entry.id !== studentId)
    });
  };

  const getSession = async (sessionId: string): Promise<PAPSSession> => {
    const state = await getState();
    const session = state.sessions.find((entry) => entry.id === sessionId);

    if (!session) {
      throw new Error(`Session ${sessionId} was not found.`);
    }

    return session;
  };

  const saveSession = async (session: PAPSSession): Promise<PAPSSession> => {
    const state = await getState();

    await persistState({
      ...input,
      client,
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: [...state.sessions.filter((entry) => entry.id !== session.id), session],
      students: state.allStudents
    });

    return session;
  };

  const deleteSession = async (sessionId: string): Promise<void> => {
    const state = await getState();

    await persistState({
      ...input,
      client,
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      sessions: state.sessions.filter((entry) => entry.id !== sessionId),
      students: state.allStudents
    });
  };

  return {
    getTeacherBootstrap,
    getClass: ((classId: string) => getClass(classId)) as unknown as TeacherSheetsStore["getClass"],
    saveClass: ((classroom: PAPSClassroom) => saveClass(classroom)) as unknown as TeacherSheetsStore["saveClass"],
    deleteClass: ((classId: string) => deleteClass(classId)) as unknown as TeacherSheetsStore["deleteClass"],
    getStudent: ((studentId: string) => getStudent(studentId)) as unknown as TeacherSheetsStore["getStudent"],
    saveStudent: ((student: PAPSStudent) => saveStudent(student)) as unknown as TeacherSheetsStore["saveStudent"],
    deleteStudent: ((studentId: string) => deleteStudent(studentId)) as unknown as TeacherSheetsStore["deleteStudent"],
    getSession: ((sessionId: string) => getSession(sessionId)) as unknown as TeacherSheetsStore["getSession"],
    saveSession: ((session: PAPSSession) => saveSession(session)) as unknown as TeacherSheetsStore["saveSession"],
    deleteSession: ((sessionId: string) => deleteSession(sessionId)) as unknown as TeacherSheetsStore["deleteSession"],
    saveSchool: ((school: PAPSSchool) => saveSchool(school)) as unknown as TeacherSheetsStore["saveSchool"]
  };
};
