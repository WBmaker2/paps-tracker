import { getEventDefinition } from "../paps/catalog";
import type {
  PAPSAttempt,
  PAPSAttemptRecord,
  PAPSDemoStoreData,
  PAPSStudentEventHistoryAttempt,
  PAPSStoredAttempt
} from "../paps/types";
import type { RecordSelector } from "./paps-memory-store-types";

interface RecordReadDependencies {
  cloneValue: <T>(value: T) => T;
  ensureState: () => PAPSDemoStoreData;
  getSession: (sessionId: string) => PAPSDemoStoreData["sessions"][number];
  getStudent: (studentId: string) => PAPSDemoStoreData["students"][number];
  getAttemptsForRecord: (state: PAPSDemoStoreData, selector: RecordSelector) => PAPSStoredAttempt[];
  getRepresentativeAttemptId: (state: PAPSDemoStoreData, selector: RecordSelector) => string | null;
}

export const createRecordReadOperations = (deps: RecordReadDependencies) => {
  const { cloneValue, ensureState, getSession, getStudent, getAttemptsForRecord, getRepresentativeAttemptId } = deps;

  const getAttemptRecord = (selector: RecordSelector): PAPSAttemptRecord => {
    const session = getSession(selector.sessionId);
    getStudent(selector.studentId);
    const state = ensureState();
    const attempts: PAPSAttempt[] = getAttemptsForRecord(state, selector).map((attempt) => ({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey,
      detail: attempt.detail ?? null
    }));

    return cloneValue({
      sessionId: selector.sessionId,
      studentId: selector.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attempts,
      representativeAttemptId: getRepresentativeAttemptId(state, selector)
    });
  };

  const listStudentEventHistory = (selector: RecordSelector): PAPSStudentEventHistoryAttempt[] => {
    const currentSession = getSession(selector.sessionId);
    getStudent(selector.studentId);
    const state = ensureState();
    const historyAttempts = state.attempts
      .flatMap((attempt) => {
        if (attempt.studentId !== selector.studentId || attempt.eventId !== currentSession.eventId) return [];
        const session = state.sessions.find((entry) => entry.id === attempt.sessionId);
        if (!session) return [];
        if (
          currentSession.academicYear !== undefined &&
          session.academicYear !== undefined &&
          currentSession.academicYear !== session.academicYear
        ) return [];
        return [{
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          measurement: attempt.measurement,
          createdAt: attempt.createdAt,
          clientSubmissionKey: attempt.clientSubmissionKey,
          detail: attempt.detail ?? null,
          sessionId: session.id,
          sessionName: session.name ?? session.id,
          sessionType: session.sessionType,
          eventId: attempt.eventId,
          academicYear: session.academicYear,
          isCurrentSession: session.id === selector.sessionId
        }];
      })
      .sort((left, right) => {
        if (left.sessionId === right.sessionId) {
          return left.attemptNumber - right.attemptNumber || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
        }
        return left.createdAt.localeCompare(right.createdAt) || left.sessionId.localeCompare(right.sessionId) || left.attemptNumber - right.attemptNumber || left.id.localeCompare(right.id);
      });
    const seenClientSubmissionKeys = new Set<string>();
    return cloneValue(historyAttempts.filter((attempt) => {
      const key = attempt.clientSubmissionKey?.trim();
      if (!key) return true;
      if (seenClientSubmissionKeys.has(key)) return false;
      seenClientSubmissionKeys.add(key);
      return true;
    }));
  };

  return { getAttemptRecord, listStudentEventHistory };
}
