import type { GoogleSheetsClient } from "./sheets-client";
import {
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import { buildSettingsTabValues, buildStudentTabValues } from "./sheet-source-tab-values";
import { createPapsGoogleSheetTabPayloads } from "./sheets";
import { formatAttemptDetailSummary } from "../paps/composite-measurements";
import { buildRecordNote, parseRecordNote } from "./sheets-record-note";

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

interface GoogleSheetRecordWriteInput {
  spreadsheetId: string;
  client: Pick<GoogleSheetsClient, "updateRange"> &
    Partial<Pick<GoogleSheetsClient, "readRange" | "appendRows">>;
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
  input: GoogleSheetRecordWriteInput & {
    state: GoogleSheetStructuredState;
  }
): Promise<void> => {
  const values = toTabValues(input.state, "세션기록");

  if (!values) {
    return;
  }

  if (!input.client.readRange || !input.client.appendRows) {
    throw new Error("A readable, append-capable Google Sheets client is required for 세션기록 updates.");
  }

  const spec = GOOGLE_SHEET_SOURCE_WRITE_SPECS["세션기록"];
  const existingRows = await input.client.readRange(input.spreadsheetId, "'세션기록'!A2:U5000");
  const desiredRows = values.slice(1).map((row) => row.map((cell) => String(cell ?? "")));
  const existingRowById = new Map<string, { row: string[]; rowNumber: number }>();

  existingRows.forEach((row, index) => {
    const recordId = String(row[0] ?? "");

    if (recordId) {
      existingRowById.set(recordId, { row, rowNumber: index + 2 });
    }
  });

  const rowsToAppend: string[][] = [];

  for (const desiredRow of desiredRows) {
    const recordId = desiredRow[0] ?? "";
    const existing = existingRowById.get(recordId);

    if (!existing) {
      rowsToAppend.push(desiredRow);
      continue;
    }

    const paddedExisting = Array.from({ length: spec.columnCount }, (_, index) =>
      String(existing.row[index] ?? "")
    );
    const paddedDesired = Array.from({ length: spec.columnCount }, (_, index) =>
      String(desiredRow[index] ?? "")
    );
    const changedColumns = paddedDesired.flatMap((value, index) =>
      value === paddedExisting[index] ? [] : [index]
    );

    if (changedColumns.length === 0) {
      continue;
    }

    // Patch only changed cells so a stale in-memory snapshot cannot replace unrelated
    // columns on the row. This also avoids clearing rows that are absent from state.
    for (const columnIndex of changedColumns) {
      const columnName = String.fromCharCode("A".charCodeAt(0) + columnIndex);

      await input.client.updateRange(
        input.spreadsheetId,
        `'세션기록'!${columnName}${existing.rowNumber}`,
        [[paddedDesired[columnIndex] ?? ""]]
      );
    }
  }

  if (rowsToAppend.length > 0) {
    await input.client.appendRows(input.spreadsheetId, "'세션기록'!A:U", rowsToAppend);
  }
};

export const updateGoogleSheetRecordAttemptCells = async (input: {
  spreadsheetId: string;
  client: Pick<GoogleSheetsClient, "readRange" | "updateRange">;
  attemptId: string;
  measurement: number;
  officialGrade: string | null;
  note: string;
}): Promise<void> => {
  const rows = await input.client.readRange(input.spreadsheetId, "'세션기록'!A2:U5000");
  const rowIndex = rows.findIndex((row) => String(row[0] ?? "") === input.attemptId);

  if (rowIndex < 0) {
    throw new Error(`Attempt ${input.attemptId} was not found in 세션기록.`);
  }

  const rowNumber = rowIndex + 2;
  const cells: Array<[string, string]> = [
    [`O${rowNumber}`, String(input.measurement)],
    [`R${rowNumber}`, input.officialGrade ?? ""],
    [`U${rowNumber}`, input.note]
  ];

  for (const [cell, value] of cells) {
    await input.client.updateRange(input.spreadsheetId, `'세션기록'!${cell}`, [[value]]);
  }
};

export const updateGoogleSheetRecordSyncStatus = async (input: {
  spreadsheetId: string;
  client: Pick<GoogleSheetsClient, "readRange" | "updateRange">;
  sessionId: string;
  studentId: string;
  statusLabel: string;
}): Promise<void> => {
  const rows = await input.client.readRange(input.spreadsheetId, "'세션기록'!A2:U5000");

  for (const [index, row] of rows.entries()) {
    if (String(row[1] ?? "") !== input.sessionId || String(row[11] ?? "") !== input.studentId) {
      continue;
    }

    await input.client.updateRange(input.spreadsheetId, `'세션기록'!T${index + 2}`, [[input.statusLabel]]);
  }
};

export const updateGoogleSheetRecordRepresentativeCells = async (input: {
  spreadsheetId: string;
  client: Pick<GoogleSheetsClient, "readRange" | "updateRange">;
  state: GoogleSheetStructuredState;
  sessionId: string;
  studentId: string;
  selectedAttemptId: string | null;
  reason: string;
}): Promise<void> => {
  const session = input.state.sessions.find((entry) => entry.id === input.sessionId);

  if (!session) {
    throw new Error(`Session ${input.sessionId} was not found.`);
  }

  const teacherId = input.state.representativeSelectionAuditLogs
    .filter((entry) => entry.sessionId === input.sessionId && entry.studentId === input.studentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .at(-1)?.changedByTeacherId;
  const teacherLabel = input.state.teachers.find((entry) => entry.id === teacherId)?.email ?? teacherId ?? "";
  const desiredRows = createSourcePayloadMap(input.state).get("세션기록")?.rows ?? [];
  const desiredByAttemptId = new Map(desiredRows.map((row) => [String(row[0] ?? ""), row]));
  const rows = await input.client.readRange(input.spreadsheetId, "'세션기록'!A2:U5000");

  for (const [rowIndex, row] of rows.entries()) {
    if (String(row[1] ?? "") !== input.sessionId || String(row[11] ?? "") !== input.studentId) {
      continue;
    }

    const attemptId = String(row[0] ?? "");
    const desired = desiredByAttemptId.get(attemptId);
    const isSelected = attemptId === input.selectedAttemptId;
    const parsedNote = parseRecordNote(row[20]);
    const note = buildRecordNote({
      clientSubmissionKey: parsedNote.clientSubmissionKey,
      reason: input.reason,
      detail: parsedNote.detail,
      detailSummary: formatAttemptDetailSummary({ eventId: session.eventId, detail: parsedNote.detail })
    });
    const patches: Array<[number, string]> = [
      [15, isSelected ? "Y" : "N"],
      [16, isSelected ? teacherLabel : ""],
      [17, isSelected && desired ? String(desired[17] ?? "") : ""],
      [20, note]
    ];

    for (const [columnIndex, value] of patches) {
      if (String(row[columnIndex] ?? "") === value) {
        continue;
      }

      const columnName = String.fromCharCode("A".charCodeAt(0) + columnIndex);

      await input.client.updateRange(
        input.spreadsheetId,
        `'세션기록'!${columnName}${rowIndex + 2}`,
        [[value]]
      );
    }
  }
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
