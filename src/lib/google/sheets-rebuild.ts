import { buildStructuredStateFromSheet, type GoogleSheetStructuredState } from "./sheets-bootstrap";
import { canonicalizeStructuredAttempts } from "./sheet-attempt-canonicalization";
import { createPapsGoogleSheetTabPayloads } from "./sheets";
import { GoogleSheetsAccessError, type GoogleSheetsClient } from "./sheets-client";
import { createGoogleSheetClientFromEnv } from "./sheets-store";

const SUMMARY_WRITE_SPECS = {
  학생요약: { range: "'학생요약'!A1:L2000", rowCount: 2000, columnCount: 12 },
  공식평가요약: { range: "'공식평가요약'!A1:K2000", rowCount: 2000, columnCount: 11 }
} as const;

type SummaryTabName = keyof typeof SUMMARY_WRITE_SPECS;

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

const createSummaryPayloads = (state: GoogleSheetStructuredState): Map<SummaryTabName, string[][]> => {
  const payloads = createPapsGoogleSheetTabPayloads({
    school: state.school,
    classes: state.classes,
    teachers: state.teachers,
    students: state.allStudents,
    sessions: state.sessions,
    attempts: state.attempts,
    syncStatuses: state.syncStatuses,
    syncErrorLogs: state.syncErrorLogs,
    representativeSelectionAuditLogs: state.representativeSelectionAuditLogs
  });

  return new Map(
    payloads
      .filter(
        (payload): payload is (typeof payloads)[number] & { tabName: SummaryTabName } =>
          payload.tabName === "학생요약" || payload.tabName === "공식평가요약"
      )
      .map((payload) => [
        payload.tabName,
        [payload.header, ...payload.rows.map((row) => row.map((cell) => String(cell ?? "")))]
      ])
  );
};

export const rebuildGoogleSheetSummaries = async (input: {
  spreadsheetId: string;
  teacherEmail: string;
  client?: GoogleSheetsClient;
}): Promise<
  | {
      ok: true;
      updatedTabs: SummaryTabName[];
      duplicateAttemptCount: number;
      duplicateRecordCount: number;
    }
  | {
      ok: false;
      error: string;
      status: number;
      rebuildNeeded: boolean;
      duplicateAttemptCount: number;
      duplicateRecordCount: number;
      failedTabs: SummaryTabName[];
    }
> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();

  try {
    const structuredState = await buildStructuredStateFromSheet({
      client,
      spreadsheetId: input.spreadsheetId,
      teacherEmail: input.teacherEmail
    });
    const deduped = canonicalizeStructuredAttempts(structuredState);
    const payloads = createSummaryPayloads(deduped.state);
    const updatedTabs: SummaryTabName[] = [];
    const failedTabs: SummaryTabName[] = [];

    for (const tabName of Object.keys(SUMMARY_WRITE_SPECS) as SummaryTabName[]) {
      const values = payloads.get(tabName);

      if (!values) {
        failedTabs.push(tabName);
        continue;
      }

      const spec = SUMMARY_WRITE_SPECS[tabName];

      try {
        await client.updateRange(
          input.spreadsheetId,
          spec.range,
          padRows(values, spec.rowCount, spec.columnCount)
        );
        updatedTabs.push(tabName);
      } catch {
        failedTabs.push(tabName);
      }
    }

    if (failedTabs.length > 0) {
      return {
        ok: false,
        error: "요약 탭 재계산 중 일부 탭을 업데이트하지 못했습니다.",
        status: 500,
        rebuildNeeded: true,
        duplicateAttemptCount: deduped.duplicateAttemptCount,
        duplicateRecordCount: deduped.duplicateRecordCount,
        failedTabs
      };
    }

    return {
      ok: true,
      updatedTabs,
      duplicateAttemptCount: deduped.duplicateAttemptCount,
      duplicateRecordCount: deduped.duplicateRecordCount
    };
  } catch (error) {
    if (error instanceof GoogleSheetsAccessError) {
      return {
        ok: false,
        error: error.message,
        status: 503,
        rebuildNeeded: false,
        duplicateAttemptCount: 0,
        duplicateRecordCount: 0,
        failedTabs: []
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "요약 재계산을 완료하지 못했습니다.",
      status: 400,
      rebuildNeeded: false,
      duplicateAttemptCount: 0,
      duplicateRecordCount: 0,
      failedTabs: []
    };
  }
};
