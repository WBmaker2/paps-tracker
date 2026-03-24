import { buildStructuredStateFromSheet, type GoogleSheetStructuredState } from "./sheets-bootstrap";
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

const compareAttemptOrder = (
  left: Pick<GoogleSheetStructuredState["attempts"][number], "createdAt" | "attemptNumber" | "id">,
  right: Pick<GoogleSheetStructuredState["attempts"][number], "createdAt" | "attemptNumber" | "id">
): number => {
  const createdAtComparison = left.createdAt.localeCompare(right.createdAt);

  if (createdAtComparison !== 0) {
    return createdAtComparison;
  }

  if (left.attemptNumber !== right.attemptNumber) {
    return left.attemptNumber - right.attemptNumber;
  }

  return left.id.localeCompare(right.id);
};

const dedupeStructuredAttempts = (state: GoogleSheetStructuredState): {
  state: GoogleSheetStructuredState;
  duplicateAttemptCount: number;
  duplicateRecordCount: number;
} => {
  const groups = new Map<string, typeof state.attempts>();

  for (const attempt of state.attempts) {
    const key = attempt.clientSubmissionKey?.trim();

    if (!key) {
      continue;
    }

    const duplicateGroupKey = `${attempt.sessionId}:${attempt.studentId}:${key}`;
    const currentGroup = groups.get(duplicateGroupKey) ?? [];

    currentGroup.push(attempt);
    groups.set(duplicateGroupKey, currentGroup);
  }

  const duplicateToCanonicalId = new Map<string, string>();
  let duplicateAttemptCount = 0;
  let duplicateRecordCount = 0;

  for (const attempts of groups.values()) {
    if (attempts.length < 2) {
      continue;
    }

    duplicateRecordCount += 1;
    const sortedAttempts = [...attempts].sort(compareAttemptOrder);
    const canonicalAttempt = sortedAttempts[0];

    for (const duplicateAttempt of sortedAttempts.slice(1)) {
      duplicateToCanonicalId.set(duplicateAttempt.id, canonicalAttempt.id);
      duplicateAttemptCount += 1;
    }
  }

  if (duplicateToCanonicalId.size === 0) {
    return {
      state,
      duplicateAttemptCount,
      duplicateRecordCount
    };
  }

  return {
    state: {
      ...state,
      attempts: state.attempts.filter((attempt) => !duplicateToCanonicalId.has(attempt.id)),
      syncStatuses: state.syncStatuses.map((entry) => ({
        ...entry,
        attemptId: entry.attemptId ? duplicateToCanonicalId.get(entry.attemptId) ?? entry.attemptId : entry.attemptId
      })),
      representativeSelectionAuditLogs: state.representativeSelectionAuditLogs.map((entry) => ({
        ...entry,
        previousAttemptId: entry.previousAttemptId
          ? duplicateToCanonicalId.get(entry.previousAttemptId) ?? entry.previousAttemptId
          : entry.previousAttemptId,
        selectedAttemptId: entry.selectedAttemptId
          ? duplicateToCanonicalId.get(entry.selectedAttemptId) ?? entry.selectedAttemptId
          : entry.selectedAttemptId
      }))
    },
    duplicateAttemptCount,
    duplicateRecordCount
  };
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
    const deduped = dedupeStructuredAttempts(structuredState);
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
