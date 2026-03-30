import { getEventDefinition } from "./paps/catalog";
import { createRecordId } from "./paps/record-id";
import type {
  EventId,
  PAPSAttempt,
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSSession,
  PAPSSyncErrorLog,
  PAPSSyncState,
  PAPSSyncStatusRecord,
  PAPSStudent
} from "./paps/types";

export const selectPrimaryResultsSession = (sessions: PAPSSession[]): PAPSSession | null =>
  [...sessions].sort((left, right) => {
    const leftOpenRank = left.isOpen ? 1 : 0;
    const rightOpenRank = right.isOpen ? 1 : 0;

    return (
      rightOpenRank - leftOpenRank ||
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
    );
  })[0] ?? null;

export interface TeacherResultRowView {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentNameNormalized: string;
  studentNumber: number | null;
  classId: string;
  classLabel: string;
  classNumber: number | null;
  gradeLevel: 3 | 4 | 5 | 6;
  schoolId: string | null;
  sessionName: string;
  sessionType: "official" | "practice";
  eventId: EventId;
  eventLabel: string;
  unit: string;
  representativeAttemptId: string | null;
  attempts: PAPSAttempt[];
  duplicateAttemptCount: number;
}

export interface TeacherResultFilterOptions {
  grades: Array<{
    value: 3 | 4 | 5 | 6;
    label: string;
  }>;
  classes: Array<{
    value: string;
    label: string;
    gradeLevel: 3 | 4 | 5 | 6;
  }>;
  events: Array<{
    value: EventId;
    label: string;
  }>;
  sessionTypes: Array<{
    value: "all" | "official" | "practice";
    label: string;
  }>;
}

export interface TeacherResultSyncView {
  status: PAPSSyncState;
  updatedAt: string;
  message: string | null;
}

export interface TeacherResultsViewModel {
  rows: TeacherResultRowView[];
  filterOptions: TeacherResultFilterOptions;
  initialFocusRecordId: string | null;
  summariesNote: string;
  syncStateByRecordId: Record<string, TeacherResultSyncView>;
}

export interface BuildTeacherResultsViewModelInput {
  classes: PAPSClassroom[];
  students: PAPSStudent[];
  sessions: PAPSSession[];
  recordsBySession: Record<string, PAPSAttemptRecord[]>;
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
}

const DEFAULT_SUMMARIES_NOTE =
  "이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다.";

const normalizeStudentName = (name: string): string => name.trim().toLocaleLowerCase("ko-KR");

const countDuplicateAttempts = (attempts: PAPSAttempt[]): number => {
  const seenKeys = new Set<string>();
  let duplicateCount = 0;

  for (const attempt of attempts) {
    const key = attempt.clientSubmissionKey?.trim();

    if (!key) {
      continue;
    }

    if (seenKeys.has(key)) {
      duplicateCount += 1;
      continue;
    }

    seenKeys.add(key);
  }

  return duplicateCount;
};

const sortSessionsForResults = (sessions: PAPSSession[]): PAPSSession[] =>
  [...sessions].sort((left, right) => {
    const leftOpenRank = left.isOpen ? 1 : 0;
    const rightOpenRank = right.isOpen ? 1 : 0;

    return (
      rightOpenRank - leftOpenRank ||
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
    );
  });

const buildTeacherResultFilterOptions = (
  rows: TeacherResultRowView[]
): TeacherResultFilterOptions => ({
  grades: [...new Set(rows.map((row) => row.gradeLevel))]
    .sort((left, right) => left - right)
    .map((gradeLevel) => ({
      value: gradeLevel,
      label: `${gradeLevel}학년`
    })),
  classes: [
    ...new Map(
      rows.map((row) => [
        row.classId,
        {
          value: row.classId,
          label: row.classLabel,
          gradeLevel: row.gradeLevel
        }
      ])
    ).values()
  ].sort(
    (left, right) =>
      left.gradeLevel - right.gradeLevel ||
      left.label.localeCompare(right.label, "ko")
  ),
  events: [
    ...new Map(
      rows.map((row) => [
        row.eventId,
        {
          value: row.eventId,
          label: row.eventLabel
        }
      ])
    ).values()
  ].sort((left, right) => left.value.localeCompare(right.value)),
  sessionTypes: [
    { value: "all", label: "전체" },
    { value: "official", label: "공식" },
    { value: "practice", label: "연습" }
  ]
});

export const buildTeacherResultsViewModel = ({
  classes,
  students,
  sessions,
  recordsBySession,
  syncStatuses,
  syncErrorLogs
}: BuildTeacherResultsViewModelInput): TeacherResultsViewModel => {
  const sortedSessions = sortSessionsForResults(sessions);
  const sessionOrder = new Map(sortedSessions.map((session, index) => [session.id, index]));
  const classesById = new Map(classes.map((classroom) => [classroom.id, classroom]));
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const rows = sortedSessions
    .flatMap((session) =>
      (recordsBySession[session.id] ?? []).map((record) => {
        const student = studentsById.get(record.studentId) ?? null;
        const classroom =
          (student?.classId ? classesById.get(student.classId) : null) ??
          session.classTargets
            .map((target) => classesById.get(target.classId) ?? null)
            .find((entry) => Boolean(entry)) ??
          null;
        const eventDefinition = getEventDefinition(record.eventId);

        return {
          recordId: createRecordId(record),
          sessionId: record.sessionId,
          studentId: record.studentId,
          studentName: student?.name ?? record.studentId,
          studentNameNormalized: normalizeStudentName(student?.name ?? record.studentId),
          studentNumber: student?.studentNumber ?? null,
          classId: classroom?.id ?? student?.classId ?? "",
          classLabel: classroom?.label ?? "-",
          classNumber: classroom?.classNumber ?? null,
          gradeLevel: (student?.gradeLevel ?? session.gradeLevel) as 3 | 4 | 5 | 6,
          schoolId: student?.schoolId ?? session.schoolId ?? null,
          sessionName: session.name ?? session.id,
          sessionType: session.sessionType,
          eventId: record.eventId,
          eventLabel: eventDefinition.label,
          unit: record.unit,
          representativeAttemptId: record.representativeAttemptId,
          attempts: record.attempts,
          duplicateAttemptCount: countDuplicateAttempts(record.attempts)
        } satisfies TeacherResultRowView;
      })
    )
    .sort(
      (left, right) =>
        (sessionOrder.get(left.sessionId) ?? Number.MAX_SAFE_INTEGER) -
          (sessionOrder.get(right.sessionId) ?? Number.MAX_SAFE_INTEGER) ||
        left.classLabel.localeCompare(right.classLabel, "ko") ||
        (left.studentNumber ?? Number.MAX_SAFE_INTEGER) -
          (right.studentNumber ?? Number.MAX_SAFE_INTEGER) ||
        left.studentName.localeCompare(right.studentName, "ko")
    );

  const syncStateByRecordId = rows.reduce<Record<string, TeacherResultSyncView>>((accumulator, row) => {
    const syncStatus =
      syncStatuses.find(
        (entry) => entry.sessionId === row.sessionId && entry.studentId === row.studentId
      ) ?? null;
    const message =
      [...syncErrorLogs]
        .filter((entry) => entry.sessionId === row.sessionId && entry.studentId === row.studentId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1)?.message ?? null;

    accumulator[row.recordId] = {
      status: syncStatus?.status ?? "pending",
      updatedAt: syncStatus?.updatedAt ?? "-",
      message
    };

    return accumulator;
  }, {});

  return {
    rows,
    filterOptions: buildTeacherResultFilterOptions(rows),
    initialFocusRecordId: rows[0]?.recordId ?? null,
    summariesNote: DEFAULT_SUMMARIES_NOTE,
    syncStateByRecordId
  };
};
