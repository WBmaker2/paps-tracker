import { PAPS_EVENT_DEFINITIONS } from "../../data/paps/events";
import type {
  PAPSRepresentativeSelectionAuditLog,
  PAPSSession,
  PAPSSyncErrorLog,
  PAPSSyncState,
  PAPSSyncStatusRecord,
  PAPSStoredAttempt,
  PAPSTeacher
} from "../paps/types";
import { parseRecordNote } from "./sheets-record-note";

const buildEventIdByLabel = (): Map<string, PAPSSession["eventId"]> => {
  const map = new Map<string, PAPSSession["eventId"]>();

  for (const eventDefinition of Object.values(PAPS_EVENT_DEFINITIONS)) {
    map.set(eventDefinition.label, eventDefinition.id);
  }

  map.set("Sit and Reach", "sit-and-reach");
  map.set("Shuttle Run", "shuttle-run");
  map.set("Long Run Walk", "long-run-walk");
  map.set("Step Test", "step-test");
  map.set("Comprehensive Flexibility", "comprehensive-flexibility");
  map.set("Curl Up", "curl-up");
  map.set("Grip Strength", "grip-strength");
  map.set("50m Run", "fifty-meter-run");
  map.set("Standing Long Jump", "standing-long-jump");

  return map;
};

const parseSyncStatus = (value?: string | null): PAPSSyncState | null => {
  switch (value?.trim()) {
    case "대기":
    case "대기 중":
    case "pending":
      return "pending";
    case "완료":
    case "동기화 완료":
    case "synced":
      return "synced";
    case "실패":
    case "동기화 실패":
    case "failed":
      return "failed";
    default:
      return null;
  }
};

export const parseGoogleSheetRecordArtifacts = (input: {
  sessions: PAPSSession[];
  teachers: PAPSTeacher[];
  recordRows: string[][];
  errorRows: string[][];
  auditRows: string[][];
  teacherEmail: string;
  normalizeIsoValue: (value?: string | null) => string;
  createTeacherId: (email: string) => string;
}): {
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
} => {
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const teacherByEmail = new Map(
    input.teachers.map((teacher) => [teacher.email.trim().toLowerCase(), teacher])
  );
  const eventIdByLabel = buildEventIdByLabel();
  const attempts: PAPSStoredAttempt[] = [];
  const attemptSelectorById = new Map<string, { sessionId: string; studentId: string }>();
  const selectedAttemptByRecordId = new Map<
    string,
    { attemptId: string; createdAt: string; teacherEmail: string }
  >();
  const syncStatusByRecordId = new Map<string, PAPSSyncStatusRecord>();

  for (const row of input.recordRows.filter((entry) => entry[0] && entry[1] && entry[11])) {
    const session = sessionById.get(row[1]!);

    if (!session) {
      continue;
    }

    const measurement = Number(row[14]);

    if (!Number.isFinite(measurement)) {
      continue;
    }

    const createdAt = input.normalizeIsoValue(row[18] ?? row[4]);
    const recordNote = parseRecordNote(row[20]);
    const attempt: PAPSStoredAttempt = {
      id: row[0]!,
      sessionId: row[1]!,
      studentId: row[11]!,
      eventId: session.eventId,
      unit: (row[10] as PAPSStoredAttempt["unit"]) || PAPS_EVENT_DEFINITIONS[session.eventId].unit,
      attemptNumber: Number(row[13]) || 1,
      measurement,
      createdAt,
      clientSubmissionKey: recordNote.clientSubmissionKey ?? undefined,
      detail: recordNote.detail ?? null
    };

    attempts.push(attempt);
    attemptSelectorById.set(attempt.id, {
      sessionId: attempt.sessionId,
      studentId: attempt.studentId
    });

    const recordId = `${attempt.sessionId}:${attempt.studentId}`;

    if (row[15] === "Y") {
      selectedAttemptByRecordId.set(recordId, {
        attemptId: attempt.id,
        createdAt,
        teacherEmail: row[16] ?? input.teacherEmail
      });
    }

    const syncStatus = parseSyncStatus(row[19]);

    if (syncStatus) {
      const currentSyncStatus = syncStatusByRecordId.get(recordId);

      if (!currentSyncStatus || currentSyncStatus.updatedAt.localeCompare(createdAt) <= 0) {
        syncStatusByRecordId.set(recordId, {
          id: recordId,
          sessionId: attempt.sessionId,
          studentId: attempt.studentId,
          status: syncStatus,
          attemptId: attempt.id,
          updatedAt: createdAt
        });
      }
    }
  }

  const representativeSelectionAuditLogs = input.auditRows
    .filter((row) => row[0] && row[2] && row[3])
    .map((row) => {
      const session = sessionById.get(row[2]!);
      const teacher =
        teacherByEmail.get((row[1] ?? input.teacherEmail).trim().toLowerCase()) ??
        teacherByEmail.get(input.teacherEmail.trim().toLowerCase()) ??
        null;

      return {
        id: `rep:${row[2]}:${row[3]}:${input.normalizeIsoValue(row[0])}`,
        sessionId: row[2]!,
        studentId: row[3]!,
        eventId:
          session?.eventId ??
          eventIdByLabel.get(row[4] ?? "") ??
          ("sit-and-reach" as PAPSSession["eventId"]),
        previousAttemptId: row[6] || null,
        selectedAttemptId: row[7] || null,
        changedByTeacherId: teacher?.id ?? input.createTeacherId(row[1] || input.teacherEmail),
        reason: row[8] || undefined,
        createdAt: input.normalizeIsoValue(row[0])
      } satisfies PAPSRepresentativeSelectionAuditLog;
    });
  const auditRecordIds = new Set(
    representativeSelectionAuditLogs.map((auditLog) => `${auditLog.sessionId}:${auditLog.studentId}`)
  );

  for (const [recordId, selectedAttempt] of selectedAttemptByRecordId) {
    if (auditRecordIds.has(recordId)) {
      continue;
    }

    const [sessionId, studentId] = recordId.split(":");
    const session = sessionById.get(sessionId ?? "");
    const selectedTeacher =
      teacherByEmail.get(selectedAttempt.teacherEmail.trim().toLowerCase()) ??
      teacherByEmail.get(input.teacherEmail.trim().toLowerCase()) ??
      null;

    if (!session || !studentId) {
      continue;
    }

    representativeSelectionAuditLogs.push({
      id: `rep:${recordId}:${selectedAttempt.createdAt}`,
      sessionId,
      studentId,
      eventId: session.eventId,
      previousAttemptId: null,
      selectedAttemptId: selectedAttempt.attemptId,
      changedByTeacherId:
        selectedTeacher?.id ?? input.createTeacherId(selectedAttempt.teacherEmail || input.teacherEmail),
      reason: undefined,
      createdAt: selectedAttempt.createdAt
    });
  }

  const syncErrorLogs = input.errorRows
    .filter((row) => row[0] && row[3] && row[4])
    .flatMap((row) => {
      const selector =
        attemptSelectorById.get(row[4]!) ??
        (() => {
          const [sessionId, studentId] = (row[4] ?? "").split(":");

          return sessionId && studentId ? { sessionId, studentId } : null;
        })();

      if (!selector) {
        return [];
      }

      return [
        {
          id: `sync-error:${selector.sessionId}:${selector.studentId}:${input.normalizeIsoValue(row[0])}`,
          sessionId: selector.sessionId,
          studentId: selector.studentId,
          syncStatusId: `${selector.sessionId}:${selector.studentId}`,
          message: row[3]!,
          createdAt: input.normalizeIsoValue(row[0])
        } satisfies PAPSSyncErrorLog
      ];
    });

  return {
    attempts,
    syncStatuses: [...syncStatusByRecordId.values()],
    syncErrorLogs,
    representativeSelectionAuditLogs
  };
};
