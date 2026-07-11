import type { GoogleSheetStructuredState } from "./sheets-bootstrap";

const compareAttemptOrder = (
  left: Pick<GoogleSheetStructuredState["attempts"][number], "createdAt" | "attemptNumber" | "id">,
  right: Pick<GoogleSheetStructuredState["attempts"][number], "createdAt" | "attemptNumber" | "id">
): number =>
  left.createdAt.localeCompare(right.createdAt) ||
  left.attemptNumber - right.attemptNumber ||
  left.id.localeCompare(right.id);

export const canonicalizeStructuredAttempts = (
  state: GoogleSheetStructuredState
): {
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
    return { state, duplicateAttemptCount, duplicateRecordCount };
  }

  return {
    state: {
      ...state,
      attempts: state.attempts.filter((attempt) => !duplicateToCanonicalId.has(attempt.id)),
      syncStatuses: state.syncStatuses.map((entry) => ({
        ...entry,
        attemptId: entry.attemptId
          ? duplicateToCanonicalId.get(entry.attemptId) ?? entry.attemptId
          : entry.attemptId
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
