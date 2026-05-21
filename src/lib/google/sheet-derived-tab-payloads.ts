import { getEventDefinition } from "../paps/catalog";
import { formatAttemptDetailSummary, summarizeGripStrengthBilateralBest } from "../paps/composite-measurements";
import { summarizeRepresentativeRecords, summarizeStudentRecord } from "../paps/summaries";
import type {
  PAPSAttempt,
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSession,
  PAPSStoredAttempt,
  PAPSStudent,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord
} from "../paps/types";
import type { GoogleSheetCellValue, GoogleSheetTabPayload } from "./sheet-tab-contract";
import { buildRecordNote } from "./sheets-record-note";
import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "./template";

interface BuildDerivedGoogleSheetTabPayloadsInput {
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  students: PAPSStudent[];
  sessions: PAPSSession[];
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
}

const formatIsoDate = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const formatIsoDateTime = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value.slice(0, 19).replace("T", " ");
};

const toSessionTypeLabel = (sessionType: PAPSSession["sessionType"]): string =>
  sessionType === "official" ? "공식" : "연습";

const toScopeLabel = (classScope: PAPSSession["classScope"]): string =>
  classScope === "split" ? "2반 분할형" : "1반형";

const toSyncStatusLabel = (status?: PAPSSyncStatusRecord["status"] | null): string => {
  switch (status) {
    case "failed":
      return "실패";
    case "pending":
      return "대기";
    case "synced":
      return "완료";
    default:
      return "대기";
  }
};

const summarizeGripAttemptRepresentativeText = (
  attempts: ReadonlyArray<PAPSAttempt>
): string | null => {
  const summary = summarizeGripStrengthBilateralBest({ attempts: [...attempts] });

  if (!summary) {
    return null;
  }

  return `오른쪽 대표 ${summary.right}kg · 왼쪽 대표 ${summary.left}kg`;
};

const createAttemptRecords = (
  sessions: PAPSSession[],
  attempts: PAPSStoredAttempt[],
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[]
): PAPSAttemptRecord[] => {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const recordMap = new Map<string, PAPSAttemptRecord>();

  for (const attempt of attempts) {
    const session = sessionById.get(attempt.sessionId);

    if (!session) {
      continue;
    }

    const key = `${attempt.sessionId}:${attempt.studentId}`;
    const currentRecord = recordMap.get(key) ?? {
      sessionId: attempt.sessionId,
      studentId: attempt.studentId,
      eventId: session.eventId,
      unit: attempt.unit,
      attempts: [],
      representativeAttemptId: null
    };

    currentRecord.attempts.push({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey,
      detail: attempt.detail ?? null
    });
    recordMap.set(key, currentRecord);
  }

  for (const record of recordMap.values()) {
    record.attempts.sort((left, right) => left.attemptNumber - right.attemptNumber);
    record.representativeAttemptId =
      representativeSelectionAuditLogs
        .filter(
          (entry) => entry.sessionId === record.sessionId && entry.studentId === record.studentId
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1)?.selectedAttemptId ?? null;
  }

  return [...recordMap.values()];
};

export const buildDerivedGoogleSheetTabPayloads = ({
  classes,
  teachers,
  students,
  sessions,
  attempts,
  syncStatuses,
  syncErrorLogs,
  representativeSelectionAuditLogs
}: BuildDerivedGoogleSheetTabPayloadsInput): GoogleSheetTabPayload[] => {
  const classById = new Map(classes.map((classroom) => [classroom.id, classroom]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const syncStatusByRecordId = new Map(syncStatuses.map((status) => [status.id, status]));
  const latestAuditByRecordId = new Map<string, PAPSRepresentativeSelectionAuditLog>();
  const attemptRecords = createAttemptRecords(sessions, attempts, representativeSelectionAuditLogs);

  for (const auditLog of representativeSelectionAuditLogs) {
    const key = `${auditLog.sessionId}:${auditLog.studentId}`;
    const currentAudit = latestAuditByRecordId.get(key);

    if (!currentAudit || currentAudit.createdAt.localeCompare(auditLog.createdAt) < 0) {
      latestAuditByRecordId.set(key, auditLog);
    }
  }

  const representativeSummaries = summarizeRepresentativeRecords({
    students,
    sessions,
    records: attemptRecords
  });
  const officialSummaryByRecordId = new Map(
    representativeSummaries.officialSummaries.map((summary) => [`${summary.sessionId}:${summary.studentId}`, summary])
  );

  const recordsTab = {
    tabName: "세션기록",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[2]!.header,
    rows: attemptRecords.flatMap((record) => {
      const session = sessionById.get(record.sessionId);
      const student = studentById.get(record.studentId);
      const syncStatus = syncStatusByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const auditLog = latestAuditByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const teacherEmail = auditLog
        ? (teacherById.get(auditLog.changedByTeacherId)?.email ?? auditLog.changedByTeacherId)
        : "";
      const officialSummary = officialSummaryByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const targetClassLabels =
        session?.classTargets
          .map((target) => classById.get(target.classId)?.label ?? target.classId)
          .join("+") ?? "";
      const primaryClass = session?.classTargets[0]
        ? classById.get(session.classTargets[0].classId)
        : null;
      const recordSummary =
        session && student
          ? summarizeStudentRecord({
              session,
              student,
              record
            })
          : null;

      return record.attempts.map((attempt) => [
        attempt.id,
        record.sessionId,
        session?.name ?? record.sessionId,
        session?.academicYear ?? primaryClass?.academicYear ?? "",
        formatIsoDate(attempt.createdAt),
        session ? toSessionTypeLabel(session.sessionType) : "",
        session ? toScopeLabel(session.classScope) : "",
        targetClassLabels,
        primaryClass?.classNumber ?? "",
        getEventDefinition(record.eventId).label,
        record.unit,
        record.studentId,
        student?.name ?? record.studentId,
        attempt.attemptNumber,
        attempt.measurement,
        attempt.id === record.representativeAttemptId ? "Y" : "N",
        attempt.id === record.representativeAttemptId ? teacherEmail : "",
        attempt.id === record.representativeAttemptId
          ? recordSummary?.officialGrade ?? officialSummary?.officialGrade ?? ""
          : "",
        formatIsoDateTime(attempt.createdAt),
        toSyncStatusLabel(syncStatus?.status),
        buildRecordNote({
          clientSubmissionKey: attempt.clientSubmissionKey,
          reason: auditLog?.reason ?? null,
          detail: attempt.detail ?? null,
          detailSummary: formatAttemptDetailSummary({
            eventId: record.eventId,
            detail: attempt.detail
          })
        })
      ]);
    })
  };
  const studentSummaryTab = {
    tabName: "학생요약",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[3]!.header,
    rows: representativeSummaries.studentSummaries.map((summary) => {
      const classroom = classById.get(summary.classId);
      const latestRecord = attemptRecords.find(
        (attemptRecord) =>
          attemptRecord.sessionId === summary.latestSessionId &&
          attemptRecord.studentId === summary.studentId &&
          attemptRecord.sessionId &&
          attemptRecord.studentId
      );
      const bilateralRepresentativeText =
        summary.eventId === "grip-strength"
          ? summarizeGripAttemptRepresentativeText(latestRecord?.attempts ?? [])
          : null;
      const displayMessage = bilateralRepresentativeText
        ? `${summary.message} · ${bilateralRepresentativeText}`
        : summary.message;

      return [
        summary.studentId,
        summary.studentName,
        summary.gradeLevel,
        classroom?.classNumber ?? "",
        getEventDefinition(summary.eventId).label,
        summary.latestRepresentativeMeasurement,
        summary.unit,
        summary.previousRepresentativeMeasurement ?? "",
        summary.improvement ?? "",
        summary.bestRepresentativeMeasurement,
        formatIsoDate(summary.latestMeasuredAt),
        displayMessage
      ];
    })
  };
  const officialSummaryTab = {
    tabName: "공식평가요약",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[4]!.header,
    rows: representativeSummaries.officialSummaries.map((summary) => {
      const classroom = classById.get(summary.classId);
      const auditLog = latestAuditByRecordId.get(`${summary.sessionId}:${summary.studentId}`);
      const representativeRecord = attemptRecords.find(
        (record) =>
          record.sessionId === summary.sessionId && record.studentId === summary.studentId
      );
      const representativeAttempt =
        representativeRecord?.attempts.find(
          (attempt) => attempt.id === representativeRecord.representativeAttemptId
        ) ?? null;
      const detailSummary = representativeAttempt
        ? formatAttemptDetailSummary({
            eventId: summary.eventId,
            detail: representativeAttempt.detail
          })
        : null;
      const summaryRepresentativeRecord = attemptRecords.find(
        (record) =>
          record.sessionId === summary.sessionId && record.studentId === summary.studentId
      );
      const bilateralRepresentativeText =
        summary.eventId === "grip-strength"
          ? summarizeGripAttemptRepresentativeText(summaryRepresentativeRecord?.attempts ?? [])
          : null;

      return [
        summary.studentId,
        summary.studentName,
        summary.gradeLevel,
        classroom?.classNumber ?? "",
        getEventDefinition(summary.eventId).label,
        summary.representativeMeasurement,
        summary.unit,
        summary.officialGrade ?? "",
        formatIsoDate(summary.measuredAt),
        summary.sessionName,
        [auditLog?.reason ?? summary.note, detailSummary, bilateralRepresentativeText]
          .filter(Boolean)
          .join(" · ")
      ];
    })
  };
  const errorLogTab = {
    tabName: "오류로그",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[5]!.header,
    rows: syncErrorLogs.map((errorLog) => {
      const syncStatus = syncStatuses.find((entry) => entry.id === errorLog.syncStatusId) ?? null;

      return [
        formatIsoDateTime(errorLog.createdAt),
        "WARN",
        "시트동기화",
        errorLog.message,
        syncStatus?.attemptId ?? errorLog.syncStatusId,
        toSyncStatusLabel(syncStatus?.status),
        syncStatus?.status === "synced" ? formatIsoDateTime(syncStatus.updatedAt) : ""
      ];
    })
  };
  const auditLogTab = {
    tabName: "수정로그",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[6]!.header,
    rows: representativeSelectionAuditLogs.map((auditLog) => [
      formatIsoDateTime(auditLog.createdAt),
      teacherById.get(auditLog.changedByTeacherId)?.email ?? auditLog.changedByTeacherId,
      auditLog.sessionId,
      auditLog.studentId,
      getEventDefinition(auditLog.eventId).label,
      "대표값선택",
      auditLog.previousAttemptId ?? "",
      auditLog.selectedAttemptId ?? "",
      auditLog.reason ?? ""
    ])
  };

  return [recordsTab, studentSummaryTab, officialSummaryTab, errorLogTab, auditLogTab];
};
