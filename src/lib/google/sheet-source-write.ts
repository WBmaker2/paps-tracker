import type { GoogleSheetsClient } from "./sheets-client";
import {
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import { buildSettingsTabValues, buildStudentTabValues } from "./sheet-source-tab-values";
import { createPapsGoogleSheetTabPayloads } from "./sheets";

const GOOGLE_SHEET_SOURCE_WRITE_SPECS = {
  설정: { range: "'설정'!A1:F200", rowCount: 200, columnCount: 6 },
  학생명단: { range: "'학생명단'!A1:I1000", rowCount: 1000, columnCount: 9 },
  세션기록: { range: "'세션기록'!A1:U5000", rowCount: 5000, columnCount: 21 },
  오류로그: { range: "'오류로그'!A1:G2000", rowCount: 2000, columnCount: 7 },
  수정로그: { range: "'수정로그'!A1:I2000", rowCount: 2000, columnCount: 9 }
} as const;

interface GoogleSheetSourceWriteInput {
  spreadsheetId: string;
  client: Pick<GoogleSheetsClient, "updateRange">;
}

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

const updateGoogleSheetSourceTab = async (
  input: GoogleSheetSourceWriteInput,
  tabName: keyof typeof GOOGLE_SHEET_SOURCE_WRITE_SPECS,
  values: string[][]
): Promise<void> => {
  const spec = GOOGLE_SHEET_SOURCE_WRITE_SPECS[tabName];

  await input.client.updateRange(
    input.spreadsheetId,
    spec.range,
    padRows(values, spec.rowCount, spec.columnCount)
  );
};

const createSourcePayloadMap = (state: GoogleSheetStructuredState) =>
  new Map(
    createPapsGoogleSheetTabPayloads({
      school: state.school,
      classes: state.classes,
      teachers: state.teachers,
      students: state.allStudents,
      sessions: state.sessions,
      attempts: state.attempts,
      syncStatuses: state.syncStatuses,
      syncErrorLogs: state.syncErrorLogs,
      representativeSelectionAuditLogs: state.representativeSelectionAuditLogs
    }).map((payload) => [payload.tabName, payload])
  );

const toTabValues = (state: GoogleSheetStructuredState, tabName: string): string[][] | null => {
  const payload = createSourcePayloadMap(state).get(tabName);

  if (!payload) {
    return null;
  }

  return [payload.header, ...payload.rows.map((row) => row.map((cell) => String(cell ?? "")))];
};

export const writeGoogleSheetSettingsSourceTab = async (
  input: GoogleSheetSourceWriteInput & {
    state: Pick<GoogleSheetStructuredState, "school" | "classes" | "teachers" | "sessions"> & Partial<Pick<GoogleSheetStructuredState, "assessmentRounds">>;
  }
): Promise<void> => {
  await updateGoogleSheetSourceTab(input, "설정", buildSettingsTabValues({
    spreadsheetId: input.spreadsheetId,
    school: input.state.school,
    classes: input.state.classes,
    teachers: input.state.teachers,
    sessions: input.state.sessions,
    assessmentRounds: input.state.assessmentRounds
  }));
};

export const writeGoogleSheetStudentsSourceTab = async (
  input: GoogleSheetSourceWriteInput & {
    state: Pick<GoogleSheetStructuredState, "allStudents" | "classes">;
  }
): Promise<void> => {
  await updateGoogleSheetSourceTab(input, "학생명단", buildStudentTabValues({
    students: input.state.allStudents,
    classes: input.state.classes
  }));
};

export const writeGoogleSheetRecordSourceTab = async (
  input: GoogleSheetSourceWriteInput & {
    state: GoogleSheetStructuredState;
  }
): Promise<void> => {
  const values = toTabValues(input.state, "세션기록");

  if (!values) {
    return;
  }

  await updateGoogleSheetSourceTab(input, "세션기록", values);
};

export const writeGoogleSheetErrorLogSourceTab = async (
  input: GoogleSheetSourceWriteInput & {
    state: GoogleSheetStructuredState;
  }
): Promise<void> => {
  const values = toTabValues(input.state, "오류로그");

  if (!values) {
    return;
  }

  await updateGoogleSheetSourceTab(input, "오류로그", values);
};

export const writeGoogleSheetAuditLogSourceTab = async (
  input: GoogleSheetSourceWriteInput & {
    state: GoogleSheetStructuredState;
  }
): Promise<void> => {
  const values = toTabValues(input.state, "수정로그");

  if (!values) {
    return;
  }

  await updateGoogleSheetSourceTab(input, "수정로그", values);
};
