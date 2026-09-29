import type {
  OfficialGrade,
  PAPSAttempt,
  PAPSStudentEventHistoryAttempt,
  PAPSStudentRoundSubmitProgress,
  PAPSStudentRoundSubmitFinalizedResult
} from "../paps/types";

export type StudentSubmissionSheetResult =
  | {
      ok: true;
      result: {
        student: { id: string; name: string };
        attempts: PAPSAttempt[];
        historyAttempts?: PAPSStudentEventHistoryAttempt[];
        latestOfficialGrade: OfficialGrade | null;
        roundProgress?: PAPSStudentRoundSubmitProgress;
        finalizedResult?: PAPSStudentRoundSubmitFinalizedResult | null;
        summaryWarning?: string;
      };
    }
  | { ok: false; error: string; status: number };

export const dedupeAttemptsByClientSubmissionKey = (attempts: PAPSAttempt[]): PAPSAttempt[] => {
  const seenKeys = new Set<string>();
  const sortedAttempts = [...attempts].sort(
    (left, right) =>
      left.attemptNumber - right.attemptNumber || left.createdAt.localeCompare(right.createdAt)
  );

  return sortedAttempts.filter((attempt) => {
    const key = attempt.clientSubmissionKey?.trim();

    if (!key) {
      return true;
    }

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
};

export const getNextAttemptNumberFromSheet = (input: {
  rows: string[][];
  attempts: PAPSAttempt[];
  sessionId: string;
  studentId: string;
}): number => {
  const knownMaximum = input.attempts.reduce(
    (maximum, attempt) => Math.max(maximum, attempt.attemptNumber),
    0
  );
  const storedMaximum = input.rows.reduce((maximum, row) => {
    if (String(row[1] ?? "") !== input.sessionId || String(row[11] ?? "") !== input.studentId) {
      return maximum;
    }

    return Math.max(maximum, Number(row[13]) || 0);
  }, 0);

  return Math.max(knownMaximum, storedMaximum) + 1;
};
