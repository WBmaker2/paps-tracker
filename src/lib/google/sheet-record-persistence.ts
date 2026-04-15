import { createRecordId } from "../paps/record-id";
import { selectRepresentativeAttempt as applyRepresentativeSelection } from "../paps/summaries";
import type {
  PAPSAttemptRecord,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSession,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord
} from "../paps/types";
import type {
  RecordSelector,
  SelectRepresentativeAttemptInput,
  SetSyncStatusInput
} from "../store/paps-store-types";
import type { GoogleSheetStructuredState } from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import {
  writeGoogleSheetAuditLogSourceTab,
  writeGoogleSheetErrorLogSourceTab,
  writeGoogleSheetRecordSourceTab
} from "./sheet-source-write";

export const buildAttemptRecordsForSession = (
  state: GoogleSheetStructuredState,
  sessionId: string
): PAPSAttemptRecord[] => {
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  const targetClassIds = new Set(session.classTargets.map((target) => target.classId));
  const latestAuditByRecordId = new Map<string, PAPSRepresentativeSelectionAuditLog>();

  for (const auditLog of state.representativeSelectionAuditLogs) {
    const recordId = createRecordId(auditLog);
    const currentAuditLog = latestAuditByRecordId.get(recordId);

    if (!currentAuditLog || currentAuditLog.createdAt.localeCompare(auditLog.createdAt) <= 0) {
      latestAuditByRecordId.set(recordId, auditLog);
    }
  }

  const recordMap = new Map<string, PAPSAttemptRecord>();
  const targetedStudents = state.allStudents.filter((student) => targetClassIds.has(student.classId));

  for (const student of targetedStudents) {
    recordMap.set(createRecordId({ sessionId, studentId: student.id }), {
      sessionId,
      studentId: student.id,
      eventId: session.eventId,
      unit: state.attempts.find((attempt) => attempt.sessionId === sessionId)?.unit ?? "cm",
      attempts: [],
      representativeAttemptId:
        latestAuditByRecordId.get(createRecordId({ sessionId, studentId: student.id }))
          ?.selectedAttemptId ?? null
    });
  }

  for (const attempt of state.attempts.filter((entry) => entry.sessionId === sessionId)) {
    const recordId = createRecordId(attempt);
    const record =
      recordMap.get(recordId) ??
      ({
        sessionId,
        studentId: attempt.studentId,
        eventId: attempt.eventId,
        unit: attempt.unit,
        attempts: [],
        representativeAttemptId:
          latestAuditByRecordId.get(recordId)?.selectedAttemptId ?? null
      } satisfies PAPSAttemptRecord);

    record.attempts.push({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey
    });
    recordMap.set(recordId, record);
  }

  return [...recordMap.values()]
    .map((record) => ({
      ...record,
      attempts: [...record.attempts].sort((left, right) => left.attemptNumber - right.attemptNumber),
      representativeAttemptId:
        latestAuditByRecordId.get(createRecordId(record))?.selectedAttemptId ??
        record.representativeAttemptId
    }))
    .sort((left, right) => left.studentId.localeCompare(right.studentId));
};

export const getGoogleSheetSyncStatus = async (
  state: GoogleSheetStructuredState,
  selector: RecordSelector
): Promise<PAPSSyncStatusRecord | null> => {
  const recordId = createRecordId(selector);

  return state.syncStatuses.find((entry) => entry.id === recordId) ?? null;
};

export const setGoogleSheetSyncStatus = async ({
  client,
  spreadsheetId,
  state,
  inputStatus
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  inputStatus: SetSyncStatusInput;
}): Promise<PAPSSyncStatusRecord> => {
  const syncStatusId = createRecordId(inputStatus);
  const nextStatus: PAPSSyncStatusRecord = {
    id: syncStatusId,
    sessionId: inputStatus.sessionId,
    studentId: inputStatus.studentId,
    status: inputStatus.status,
    attemptId: inputStatus.attemptId ?? null,
    updatedAt: inputStatus.updatedAt
  };
  const nextSyncErrorLogs =
    inputStatus.status === "failed" && inputStatus.message
      ? [
          ...state.syncErrorLogs,
          {
            id: `sync-error:${syncStatusId}:${inputStatus.updatedAt}`,
            sessionId: inputStatus.sessionId,
            studentId: inputStatus.studentId,
            syncStatusId,
            message: inputStatus.message,
            createdAt: inputStatus.updatedAt
          } satisfies PAPSSyncErrorLog
        ]
      : state.syncErrorLogs;
  const nextState: GoogleSheetStructuredState = {
    ...state,
    syncStatuses: [...state.syncStatuses.filter((entry) => entry.id !== syncStatusId), nextStatus],
    syncErrorLogs: nextSyncErrorLogs
  };

  await writeGoogleSheetRecordSourceTab({
    client,
    spreadsheetId,
    state: nextState
  });

  if (inputStatus.status === "failed" && inputStatus.message) {
    await writeGoogleSheetErrorLogSourceTab({
      client,
      spreadsheetId,
      state: nextState
    });
  }

  return nextStatus;
};

export const selectGoogleSheetRepresentativeAttempt = async ({
  client,
  spreadsheetId,
  state,
  selection
}: {
  client: Pick<GoogleSheetsClient, "updateRange">;
  spreadsheetId: string;
  state: GoogleSheetStructuredState;
  selection: SelectRepresentativeAttemptInput;
}): Promise<PAPSAttemptRecord> => {
  const record = buildAttemptRecordsForSession(state, selection.sessionId).find(
    (entry) => entry.studentId === selection.studentId
  );

  if (!record) {
    throw new Error(
      `Representative record ${selection.sessionId}:${selection.studentId} was not found.`
    );
  }

  const updatedRecord = applyRepresentativeSelection(record, selection.attemptId);
  const session = state.sessions.find((entry) => entry.id === selection.sessionId);

  if (!session) {
    throw new Error(`Session ${selection.sessionId} was not found.`);
  }

  const auditLog: PAPSRepresentativeSelectionAuditLog = {
    id: `rep:${selection.sessionId}:${selection.studentId}:${selection.createdAt}`,
    sessionId: selection.sessionId,
    studentId: selection.studentId,
    eventId: session.eventId,
    previousAttemptId: record.representativeAttemptId,
    selectedAttemptId: selection.attemptId,
    changedByTeacherId: selection.changedByTeacherId,
    reason: selection.reason,
    createdAt: selection.createdAt
  };
  const nextState: GoogleSheetStructuredState = {
    ...state,
    representativeSelectionAuditLogs: [...state.representativeSelectionAuditLogs, auditLog]
  };

  await writeGoogleSheetAuditLogSourceTab({
    client,
    spreadsheetId,
    state: nextState
  });
  await writeGoogleSheetRecordSourceTab({
    client,
    spreadsheetId,
    state: nextState
  });

  return updatedRecord;
};
