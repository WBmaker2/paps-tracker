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
  , PAPSAssessmentRound, PAPSStudentRoundResult
} from "../paps/types";
import { parseGoogleSheetRecordArtifacts } from "./sheet-record-artifacts";
import {
  createTeacherId,
  normalizeIsoValue,
  parseGoogleSheetStructuredSettings,
} from "./sheet-structured-settings";
import type { GoogleSheetsClient } from "./sheets-client";
import { FOUR_FACTOR_ROUND_HEADER } from "./four-factor-round-sheet";
import { FOUR_FACTOR_IDS } from "../paps/four-factor-score";

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
  assessmentRounds: PAPSAssessmentRound[];
  studentRoundResults: PAPSStudentRoundResult[];
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
const ROUND_RESULTS_RANGE = "'4요인회차결과'!A2:AU10000";

const parseSex = (value: string): PAPSStudent["sex"] => (value === "남" ? "male" : "female");

const parseActive = (value: string): boolean => value !== "N";

const readSheetRanges = async (
  client: GoogleSheetsClient,
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> => {
  if ("readRanges" in client && typeof client.readRanges === "function") {
    return client.readRanges(spreadsheetId, ranges);
  }

  return Promise.all(ranges.map((range) => client.readRange(spreadsheetId, range)));
};

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
  const [settingsRows, studentRows, recordRows, errorRows, auditRows] = await readSheetRanges(
    client,
    spreadsheetId,
    [SETTINGS_RANGE, STUDENTS_RANGE, RECORDS_RANGE, ERRORS_RANGE, AUDITS_RANGE]
  );
  // v0.1 sheets do not have the optional tab. Keep all legacy reads usable;
  // schema migration is performed only when a round is first persisted.
  let roundRows: string[][] = [];
  try {
    roundRows = (await readSheetRanges(client, spreadsheetId, [ROUND_RESULTS_RANGE]))[0] ?? [];
  } catch (error) {
    const configuredVersion = settingsRows.find((row) => row[0] === "시트 템플릿 버전")?.[1] ?? "";
    if (configuredVersion === "v0.2-four-factor-round") throw error;
    roundRows = [];
  }
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
    ,
    assessmentRounds: structuredSettings.assessmentRounds,
    studentRoundResults: roundRows
      .filter((row) => row.length >= FOUR_FACTOR_ROUND_HEADER.length && row[0] && row[1] && Number(row[2]) > 0)
      .map((row) => ({
        roundId: row[0]!, studentId: row[1]!, revision: Number(row[2]), previousRevision: row[44] ? Number(row[44]) : null,
        status: row[3] as PAPSStudentRoundResult["status"], studentSnapshot: {
          name: row[13] ?? "", sex: row[14] === "male" ? "male" : "female", gradeLevel: Number(row[9]) as PAPSStudentRoundResult["studentSnapshot"]["gradeLevel"], classId: row[10] ?? "", classNumber: row[11] ? Number(row[11]) : null, studentNumber: row[12] ? Number(row[12]) : null
        },
        factors: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, factorIndex) => {
          const offset = 15 + factorIndex * 5;
          return [factorId, { factorId, eventId: row[offset] as PAPSStudentRoundResult["factors"][typeof factorId]["eventId"], sessionId: row[offset + 1] ?? "", representativeAttemptId: row[offset + 2] || null, measurement: row[offset + 3] ? Number(row[offset + 3]) : null, factorScore: row[offset + 4] ? Number(row[offset + 4]) : null }];
        })) as PAPSStudentRoundResult["factors"], fourFactorSubtotal: row[35] ? Number(row[35]) : null, normalizedScore: row[36] ? Number(row[36]) : null, fourFactorGrade: row[37] ? Number(row[37]) as PAPSStudentRoundResult["fourFactorGrade"] : null,
        ruleVersion: row[38] ?? "", ruleSource: row[39] ?? "", sourceFingerprint: row[40] ?? null, calculatedAt: row[41] ?? null, finalizedAt: row[42] ?? null, finalizedBy: row[43] ?? null
      }))
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
      , assessmentRounds: [], studentRoundResults: []
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
    , assessmentRounds: structuredState.assessmentRounds,
    studentRoundResults: structuredState.studentRoundResults
  };
};

export const buildTeacherBootstrapFromSheet = async (
  input: BuildTeacherBootstrapFromSheetInput
): Promise<TeacherBootstrap> =>
  toTeacherBootstrapFromStructuredState(
    await buildStructuredStateFromSheet(input),
    input.teacherEmail
  );
