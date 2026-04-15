import type { TeacherBootstrap } from "../store/paps-store-types";
import type {
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord,
  PAPSStoredAttempt,
  PAPSStudent
} from "../paps/types";
import { parseGoogleSheetRecordArtifacts } from "./sheet-record-artifacts";
import {
  createTeacherId,
  normalizeIsoValue,
  parseGoogleSheetStructuredSettings,
} from "./sheet-structured-settings";
import type { GoogleSheetsClient } from "./sheets-client";

export interface GoogleSheetStructuredState {
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  hasPersistedTeachers: boolean;
  sessions: PAPSSession[];
  allStudents: PAPSStudent[];
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
}

export interface BuildTeacherBootstrapFromSheetInput {
  client: GoogleSheetsClient;
  spreadsheetId: string;
  teacherEmail: string;
}

const SETTINGS_RANGE = "'설정'!A2:F200";
const STUDENTS_RANGE = "'학생명단'!A2:I1000";
const RECORDS_RANGE = "'세션기록'!A2:U5000";
const ERRORS_RANGE = "'오류로그'!A2:G2000";
const AUDITS_RANGE = "'수정로그'!A2:I2000";

const parseSex = (value: string): PAPSStudent["sex"] => (value === "남" ? "male" : "female");

const parseActive = (value: string): boolean => value !== "N";

const parseStudents = (rows: string[][], classes: PAPSClassroom[], schoolId: string): PAPSStudent[] => {
  const classByIdentity = new Map(
    classes.map((classroom) => [
      `${classroom.academicYear}:${classroom.gradeLevel}:${classroom.classNumber}`,
      classroom
    ])
  );

  return rows
    .filter((row) => row[0] && row[5])
    .map((row) => {
      const academicYear = Number(row[1]) || new Date().getUTCFullYear();
      const gradeLevel = Number(row[2]) as PAPSStudent["gradeLevel"];
      const classNumber = Number(row[3]);
      const classroom =
        classByIdentity.get(`${academicYear}:${gradeLevel}:${classNumber}`) ??
        classes.find(
          (entry) => entry.gradeLevel === gradeLevel && entry.classNumber === classNumber
        ) ??
        null;

      return {
        id: row[0]!,
        schoolId,
        classId: classroom?.id ?? `class-${academicYear}-${gradeLevel}-${classNumber}`,
        studentNumber: Number(row[4]) || undefined,
        name: row[5]!,
        sex: parseSex(row[6] ?? "여"),
        gradeLevel,
        active: parseActive(row[7] ?? "Y")
      } satisfies PAPSStudent;
    });
};

export const buildStructuredStateFromSheet = async ({
  client,
  spreadsheetId,
  teacherEmail
}: BuildTeacherBootstrapFromSheetInput): Promise<GoogleSheetStructuredState> => {
  const [settingsRows, studentRows, recordRows, errorRows, auditRows] = await Promise.all([
    client.readRange(spreadsheetId, SETTINGS_RANGE),
    client.readRange(spreadsheetId, STUDENTS_RANGE),
    client.readRange(spreadsheetId, RECORDS_RANGE),
    client.readRange(spreadsheetId, ERRORS_RANGE),
    client.readRange(spreadsheetId, AUDITS_RANGE)
  ]);
  const structuredSettings = parseGoogleSheetStructuredSettings({
    settingsRows,
    spreadsheetId,
    teacherEmail
  });
  const allStudents = parseStudents(
    studentRows,
    structuredSettings.classes,
    structuredSettings.school.id
  );
  const recordArtifacts = parseGoogleSheetRecordArtifacts({
    sessions: structuredSettings.sessions,
    teachers: structuredSettings.teachers,
    recordRows,
    errorRows,
    auditRows,
    teacherEmail,
    normalizeIsoValue,
    createTeacherId
  });

  return {
    ...structuredSettings,
    allStudents,
    attempts: recordArtifacts.attempts,
    syncStatuses: recordArtifacts.syncStatuses,
    syncErrorLogs: recordArtifacts.syncErrorLogs,
    representativeSelectionAuditLogs: recordArtifacts.representativeSelectionAuditLogs
  };
};

export const toTeacherBootstrapFromStructuredState = (
  structuredState: GoogleSheetStructuredState,
  teacherEmail: string
): TeacherBootstrap => {
  const normalizedTeacherEmail = teacherEmail.trim().toLowerCase();
  const teacher =
    structuredState.teachers.find(
      (entry) => entry.email.trim().toLowerCase() === normalizedTeacherEmail
    ) ?? null;

  if (structuredState.hasPersistedTeachers && !teacher) {
    return {
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
    };
  }

  return {
    teacher,
    school: structuredState.school,
    schools: [structuredState.school],
    classes: structuredState.classes,
    teachers: structuredState.teachers,
    students: structuredState.allStudents.filter((student) => student.active !== false),
    sessions: structuredState.sessions,
    attempts: structuredState.attempts,
    syncStatuses: structuredState.syncStatuses,
    syncErrorLogs: structuredState.syncErrorLogs,
    representativeSelectionAuditLogs: structuredState.representativeSelectionAuditLogs
  };
};

export const buildTeacherBootstrapFromSheet = async (
  input: BuildTeacherBootstrapFromSheetInput
): Promise<TeacherBootstrap> =>
  toTeacherBootstrapFromStructuredState(
    await buildStructuredStateFromSheet(input),
    input.teacherEmail
  );
