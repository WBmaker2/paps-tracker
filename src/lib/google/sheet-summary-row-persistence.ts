import { getEventDefinition } from "../paps/catalog";
import { buildDerivedGoogleSheetTabPayloads } from "./sheet-derived-tab-payloads";
import { canonicalizeStructuredAttempts } from "./sheet-attempt-canonicalization";
import { parseGoogleSheetRecordArtifacts } from "./sheet-record-artifacts";
import type { GoogleSheetCellValue } from "./sheet-tab-contract";
import type { GoogleSheetStructuredState } from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import { createTeacherId, normalizeIsoValue } from "./sheet-structured-settings";

const RECORDS_RANGE = "'세션기록'!A2:U5000";
const STUDENT_RUNTIME_EMAIL = "student-session@paps.local";
const SUMMARY_ROW_SPECS = {
  학생요약: {
    keyRange: "'학생요약'!A2:E2000",
    appendRange: "'학생요약'!A:L",
    lastColumn: "L"
  },
  공식평가요약: {
    keyRange: "'공식평가요약'!A2:E2000",
    appendRange: "'공식평가요약'!A:K",
    lastColumn: "K"
  }
} as const;

type SummaryTabName = keyof typeof SUMMARY_ROW_SPECS;
type SummaryRow = GoogleSheetCellValue[];

const summaryLockTails = new Map<string, Promise<void>>();

const withSummaryLock = async <T>(key: string, operation: () => Promise<T>): Promise<T> => {
  const previousTail = summaryLockTails.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const nextTail = previousTail.then(() => current);

  summaryLockTails.set(key, nextTail);
  await previousTail;

  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (summaryLockTails.get(key) === nextTail) {
      summaryLockTails.delete(key);
    }
  }
};

const readRanges = async (
  client: GoogleSheetsClient,
  spreadsheetId: string,
  ranges: string[]
): Promise<string[][][]> => {
  if (typeof client.readRanges === "function") {
    return client.readRanges(spreadsheetId, ranges);
  }

  return Promise.all(ranges.map((range) => client.readRange(spreadsheetId, range)));
};

const createFreshTargetState = ({
  state,
  recordRows,
  studentId,
  eventId
}: {
  state: GoogleSheetStructuredState;
  recordRows: string[][];
  studentId: string;
  eventId: GoogleSheetStructuredState["attempts"][number]["eventId"];
}): GoogleSheetStructuredState => {
  const attempts =
    recordRows.length > 0
      ? parseGoogleSheetRecordArtifacts({
          sessions: state.sessions,
          teachers: state.teachers,
          recordRows,
          errorRows: [],
          auditRows: [],
          teacherEmail: STUDENT_RUNTIME_EMAIL,
          normalizeIsoValue,
          createTeacherId
        }).attempts
      : state.attempts;
  const canonicalState = canonicalizeStructuredAttempts({ ...state, attempts }).state;
  const targetAttempts = canonicalState.attempts.filter(
    (attempt) => attempt.studentId === studentId && attempt.eventId === eventId
  );
  const targetSessionIds = new Set(targetAttempts.map((attempt) => attempt.sessionId));
  const targetStudent = canonicalState.allStudents.find((student) => student.id === studentId);

  if (!targetStudent) {
    throw new Error(`Student ${studentId} was not found.`);
  }

  return {
    ...canonicalState,
    allStudents: [targetStudent],
    sessions: canonicalState.sessions.filter((session) => targetSessionIds.has(session.id)),
    attempts: targetAttempts,
    syncStatuses: canonicalState.syncStatuses.filter(
      (entry) => entry.studentId === studentId && targetSessionIds.has(entry.sessionId)
    ),
    syncErrorLogs: [],
    representativeSelectionAuditLogs: canonicalState.representativeSelectionAuditLogs.filter(
      (entry) => entry.studentId === studentId && entry.eventId === eventId
    )
  };
};

const createSummaryRows = ({
  state,
  studentId,
  eventLabel
}: {
  state: GoogleSheetStructuredState;
  studentId: string;
  eventLabel: string;
}): Map<SummaryTabName, SummaryRow> => {
  const payloads = buildDerivedGoogleSheetTabPayloads({
    classes: state.classes,
    teachers: state.teachers,
    students: state.allStudents,
    sessions: state.sessions,
    attempts: state.attempts,
    syncStatuses: state.syncStatuses,
    syncErrorLogs: state.syncErrorLogs,
    representativeSelectionAuditLogs: state.representativeSelectionAuditLogs
  });
  const rows = new Map<SummaryTabName, SummaryRow>();

  for (const tabName of Object.keys(SUMMARY_ROW_SPECS) as SummaryTabName[]) {
    const payload = payloads.find((entry) => entry.tabName === tabName);
    const row = payload?.rows.find(
      (entry) => String(entry[0] ?? "") === studentId && String(entry[4] ?? "") === eventLabel
    );

    if (row) {
      rows.set(tabName, [...row]);
    }
  }

  return rows;
};

export const persistStudentSubmissionSummaryRows = async (input: {
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  sessionId: string;
  studentId: string;
  client: GoogleSheetsClient;
}): Promise<
  | { ok: true; updatedTabs: SummaryTabName[] }
  | { ok: false; error: string }
> => {
  try {
    const session = input.state.sessions.find((entry) => entry.id === input.sessionId);

    if (!session) {
      throw new Error(`Session ${input.sessionId} was not found.`);
    }

    const eventLabel = getEventDefinition(session.eventId).label;
    const lockKey = `${input.spreadsheetId}:${input.studentId}:${session.eventId}`;

    return await withSummaryLock(lockKey, async () => {
      const tabNames = Object.keys(SUMMARY_ROW_SPECS) as SummaryTabName[];
      const ranges = [
        RECORDS_RANGE,
        ...tabNames.map((tabName) => SUMMARY_ROW_SPECS[tabName].keyRange)
      ];
      const [recordRows = [], ...existingKeyRowsByTab] = await readRanges(
        input.client,
        input.spreadsheetId,
        ranges
      );
      const targetState = createFreshTargetState({
        state: input.state,
        recordRows,
        studentId: input.studentId,
        eventId: session.eventId
      });
      const summaryRows = createSummaryRows({
        state: targetState,
        studentId: input.studentId,
        eventLabel
      });
      const updatedTabs: SummaryTabName[] = [];

      for (const [tabIndex, tabName] of tabNames.entries()) {
        const row = summaryRows.get(tabName);

        if (!row) {
          continue;
        }

        const existingRowIndexes = (existingKeyRowsByTab[tabIndex] ?? []).flatMap(
          (entry, index) =>
            String(entry[0] ?? "") === input.studentId && String(entry[4] ?? "") === eventLabel
              ? [index]
              : []
        );
        const spec = SUMMARY_ROW_SPECS[tabName];

        if (existingRowIndexes.length > 0) {
          const [primaryRowIndex, ...duplicateRowIndexes] = existingRowIndexes;
          const sheetRowNumber = primaryRowIndex + 2;

          await input.client.updateRange(
            input.spreadsheetId,
            `'${tabName}'!A${sheetRowNumber}:${spec.lastColumn}${sheetRowNumber}`,
            [row]
          );

          for (const duplicateRowIndex of duplicateRowIndexes) {
            const duplicateSheetRowNumber = duplicateRowIndex + 2;

            await input.client.updateRange(
              input.spreadsheetId,
              `'${tabName}'!A${duplicateSheetRowNumber}:${spec.lastColumn}${duplicateSheetRowNumber}`,
              [row.map(() => "")]
            );
          }
        } else {
          await input.client.appendRows(input.spreadsheetId, spec.appendRange, [row]);
        }

        updatedTabs.push(tabName);
      }

      return { ok: true as const, updatedTabs };
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "요약 행을 업데이트하지 못했습니다."
    };
  }
};
