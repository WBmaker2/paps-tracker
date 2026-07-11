import type { PAPSClassroom, PAPSSchool, PAPSTeacher } from "../paps/types";
import {
  buildStructuredStateFromSheet,
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import { validatePapsGoogleSheetTemplate } from "./sheets-schema";
import { writeGoogleSheetSettingsSourceTab } from "./sheet-source-write";
import { resolveTeacherSheetInviteToken } from "./teacher-sheet-invite";

export interface ConnectTeacherGoogleSheetInput {
  spreadsheetId: string;
  normalizedUrl: string;
  teacherEmail: string;
  teacherName?: string | null;
  schoolName?: string | null;
  teacherInviteToken?: string | null;
  now?: Date;
  client: GoogleSheetsClient;
}

const createTimestamp = (now?: Date): string => (now ?? new Date()).toISOString();

const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export class CurrentTeacherNotAuthorizedForSpreadsheetError extends Error {
  readonly code = "teacher_not_authorized";

  constructor() {
    super("The current teacher is not authorized for this spreadsheet.");
    this.name = "CurrentTeacherNotAuthorizedForSpreadsheetError";
  }
}

const ensureTeacher = (
  teachers: PAPSTeacher[],
  schoolId: string,
  teacherEmail: string,
  teacherName?: string | null
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
      name: teacherName?.trim() || teacherEmail.split("@")[0] || teacherEmail,
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
  const currentTeacherExists = currentState.teachers.some(
    (teacher) => teacher.email.trim().toLowerCase() === normalizedTeacherEmail
  );

  if (currentState.hasPersistedTeachers && !currentTeacherExists) {
    if (!input.teacherInviteToken) {
      throw new CurrentTeacherNotAuthorizedForSpreadsheetError();
    }

    const invitation = resolveTeacherSheetInviteToken(input.teacherInviteToken, {
      spreadsheetId: input.spreadsheetId,
      targetEmail: normalizedTeacherEmail,
      now: input.now
    });
    const inviterStillAuthorized = currentState.teachers.some(
      (teacher) =>
        teacher.email.trim().toLowerCase() === invitation.inviterEmail
    );

    if (!inviterStillAuthorized) {
      throw new CurrentTeacherNotAuthorizedForSpreadsheetError();
    }
  }

  return ensureTeacher(
    currentState.teachers,
    currentState.school.id,
    input.teacherEmail,
    input.teacherName
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
): Promise<{
  school: PAPSSchool;
  classes: PAPSClassroom[];
  spreadsheetId: string;
  normalizedUrl: string;
}> => {
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
    updatedAt: createTimestamp(input.now)
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
    classes: currentState.classes,
    spreadsheetId: input.spreadsheetId,
    normalizedUrl: input.normalizedUrl
  };
};
