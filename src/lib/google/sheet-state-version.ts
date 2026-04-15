import { createHash } from "node:crypto";

import type { TeacherSheetStatus } from "./sheet-connection-status";
import { parseGoogleSheetStructuredSettings } from "./sheet-structured-settings";
import type { GoogleSheetsClient } from "./sheets-client";
import type { TeacherBootstrap } from "../store/paps-store-types";

export const TEACHER_STATE_VERSION_RANGES = [
  "'설정'!A2:F200",
  "'학생명단'!A2:I1000",
  "'세션기록'!A2:U5000",
  "'오류로그'!A2:G2000",
  "'수정로그'!A2:I2000"
] as const;

const normalizeStateValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeStateValue(entry))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeStateValue(nestedValue)])
    );
  }

  return value;
};

export const buildTeacherStateVersion = (bootstrap: TeacherBootstrap): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeStateValue(bootstrap)))
    .digest("hex");

export const buildTeacherSheetRowsVersion = (input: {
  settingsRows: string[][];
  studentRows: string[][];
  recordRows: string[][];
  errorRows: string[][];
  auditRows: string[][];
}): string =>
  createHash("sha256")
    .update(
      JSON.stringify(
        normalizeStateValue({
          settingsRows: input.settingsRows,
          studentRows: input.studentRows,
          recordRows: input.recordRows,
          errorRows: input.errorRows,
          auditRows: input.auditRows
        })
      )
    )
    .digest("hex");

export const readTeacherSheetVersion = async ({
  client,
  spreadsheetId,
  teacherEmail
}: {
  client: GoogleSheetsClient;
  spreadsheetId: string | null | undefined;
  teacherEmail: string;
}): Promise<{
  connected: boolean;
  version: string | null;
  reason: TeacherSheetStatus["code"] | null;
}> => {
  if (!spreadsheetId) {
    return {
      connected: false,
      version: null,
      reason: "not_connected"
    };
  }

  const [settingsRows, studentRows, recordRows, errorRows, auditRows] =
    "readRanges" in client && typeof client.readRanges === "function"
      ? await client.readRanges(spreadsheetId, [...TEACHER_STATE_VERSION_RANGES])
      : await Promise.all(
          [...TEACHER_STATE_VERSION_RANGES].map((range) => client.readRange(spreadsheetId, range))
        );
  const structuredSettings = parseGoogleSheetStructuredSettings({
    settingsRows,
    spreadsheetId,
    teacherEmail
  });
  const normalizedTeacherEmail = teacherEmail.trim().toLowerCase();
  const teacherAuthorized =
    !structuredSettings.hasPersistedTeachers ||
    structuredSettings.teachers.some(
      (teacher) => teacher.email.trim().toLowerCase() === normalizedTeacherEmail
    );

  if (!teacherAuthorized) {
    return {
      connected: false,
      version: null,
      reason: "teacher_not_authorized"
    };
  }

  return {
    connected: true,
    version: buildTeacherSheetRowsVersion({
      settingsRows,
      studentRows,
      recordRows,
      errorRows,
      auditRows
    }),
    reason: null
  };
};
