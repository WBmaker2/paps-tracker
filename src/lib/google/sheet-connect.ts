import type { PAPSSchool, PAPSTeacher } from "../paps/types";
import {
  buildStructuredStateFromSheet,
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import { validatePapsGoogleSheetTemplate } from "./sheets-schema";
import { writeGoogleSheetSettingsSourceTab } from "./sheet-source-write";

export interface ConnectTeacherGoogleSheetInput {
  spreadsheetId: string;
  normalizedUrl: string;
  teacherEmail: string;
  teacherName?: string | null;
  schoolName?: string | null;
  client: GoogleSheetsClient;
}

const createTimestamp = (): string => new Date().toISOString();

const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

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

const buildConnectedTeachers = (
  currentState: GoogleSheetStructuredState,
  input: ConnectTeacherGoogleSheetInput
): PAPSTeacher[] => {
  const timestamp = createTimestamp();
  const normalizedTeacherEmail = input.teacherEmail.trim().toLowerCase();

  if (
    currentState.hasPersistedTeachers &&
    !currentState.teachers.some(
      (teacher) => teacher.email.trim().toLowerCase() === normalizedTeacherEmail
    )
  ) {
    throw new Error("The current teacher is not authorized for this spreadsheet.");
  }

  return (
    currentState.hasPersistedTeachers
      ? currentState.teachers
      : ensureTeacher(currentState.teachers, currentState.school.id, input.teacherEmail)
  ).map((teacher) =>
    teacher.email.trim().toLowerCase() === normalizedTeacherEmail
      ? {
          ...teacher,
          name: input.teacherName?.trim() || teacher.name,
          updatedAt: timestamp
        }
      : teacher
  );
};

export const connectGoogleSheetForTeacher = async (
  input: ConnectTeacherGoogleSheetInput
): Promise<{ school: PAPSSchool; spreadsheetId: string; normalizedUrl: string }> => {
  await validatePapsGoogleSheetTemplate(input.client, input.spreadsheetId);
  const currentState = await buildStructuredStateFromSheet({
    client: input.client,
    spreadsheetId: input.spreadsheetId,
    teacherEmail: input.teacherEmail
  });
  const teachers = buildConnectedTeachers(currentState, input);
  const school: PAPSSchool = {
    ...currentState.school,
    name: input.schoolName?.trim() || currentState.school.name,
    teacherIds: teachers.map((teacher) => teacher.id),
    sheetUrl: input.normalizedUrl,
    updatedAt: createTimestamp()
  };

  await writeGoogleSheetSettingsSourceTab({
    spreadsheetId: input.spreadsheetId,
    client: input.client,
    state: {
      school,
      classes: currentState.classes,
      teachers,
      sessions: currentState.sessions
    }
  });

  return {
    school,
    spreadsheetId: input.spreadsheetId,
    normalizedUrl: input.normalizedUrl
  };
};
