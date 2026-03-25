import { getEventDefinition } from "./catalog";
import { calculateOfficialGrade } from "./grade";
import type { PAPSAttempt, PAPSAttemptRecord, PAPSRecordSummary, PAPSSession, PAPSStudent } from "./types";

export interface PAPSRepresentativeStudentSummary {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  classId: string;
  eventId: PAPSAttemptRecord["eventId"];
  latestRepresentativeMeasurement: number;
  previousRepresentativeMeasurement: number | null;
  improvement: number | null;
  bestRepresentativeMeasurement: number;
  unit: PAPSAttemptRecord["unit"];
  latestMeasuredAt: string;
  latestSessionId: string;
  latestSessionName: string;
  latestSessionType: PAPSSession["sessionType"];
  officialGrade?: PAPSRecordSummary["officialGrade"];
  message: string;
}

export interface PAPSRepresentativeOfficialSummary {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  classId: string;
  eventId: PAPSAttemptRecord["eventId"];
  representativeMeasurement: number;
  unit: PAPSAttemptRecord["unit"];
  officialGrade: PAPSRecordSummary["officialGrade"] | null;
  measuredAt: string;
  sessionId: string;
  sessionName: string;
  note: string;
}

interface RepresentativeRecordContext {
  session: PAPSSession;
  student: PAPSStudent;
  record: PAPSAttemptRecord;
  representativeAttempt: PAPSAttempt;
  usedFallbackRepresentative: boolean;
}

const getRepresentativeAttempt = (
  record: PAPSAttemptRecord,
  options?: {
    fallbackToLatest?: boolean;
  }
): {
  attempt: PAPSAttempt | null;
  usedFallbackRepresentative: boolean;
} => {
  if (!record.representativeAttemptId) {
    if (!options?.fallbackToLatest) {
      return {
        attempt: null,
        usedFallbackRepresentative: false
      };
    }

    return {
      attempt: record.attempts.at(-1) ?? null,
      usedFallbackRepresentative: true
    };
  }

  const representativeAttempt =
    record.attempts.find((attempt) => attempt.id === record.representativeAttemptId) ?? null;

  if (!representativeAttempt) {
    throw new Error(
      `Representative attempt ${record.representativeAttemptId} was not found in the record.`
    );
  }

  return {
    attempt: representativeAttempt,
    usedFallbackRepresentative: false
  };
};

const validateSummaryContext = ({
  session,
  student,
  record
}: {
  session: PAPSSession;
  student: PAPSStudent;
  record: PAPSAttemptRecord;
}): void => {
  if (record.sessionId !== session.id) {
    throw new Error("Record sessionId does not match the provided session.");
  }

  if (record.studentId !== student.id) {
    throw new Error("Record studentId does not match the provided student.");
  }

  if (record.eventId !== session.eventId) {
    throw new Error("Record eventId does not match the provided session event.");
  }

  if (record.unit !== getEventDefinition(record.eventId).unit) {
    throw new Error("Record unit does not match the event definition unit.");
  }
};

const calculateImprovement = ({
  previousRepresentativeMeasurement,
  currentRepresentativeMeasurement,
  betterDirection
}: {
  previousRepresentativeMeasurement?: number;
  currentRepresentativeMeasurement: number | null;
  betterDirection: "higher" | "lower";
}): number | null => {
  if (
    previousRepresentativeMeasurement === undefined ||
    currentRepresentativeMeasurement === null
  ) {
    return null;
  }

  if (betterDirection === "higher") {
    return currentRepresentativeMeasurement - previousRepresentativeMeasurement;
  }

  return previousRepresentativeMeasurement - currentRepresentativeMeasurement;
};

const formatSummaryMessage = ({
  sessionType,
  improvement,
  unit
}: {
  sessionType: PAPSSession["sessionType"];
  improvement: number | null;
  unit: PAPSAttemptRecord["unit"];
}): string => {
  if (sessionType === "official") {
    return "공식 기록 완료";
  }

  if (improvement === null) {
    return "첫 기록";
  }

  const sign = improvement > 0 ? "+" : "";

  return `지난 기록 대비 ${sign}${improvement}${unit}`;
};

const getSortableRepresentativeTimestamp = (context: RepresentativeRecordContext): string =>
  `${context.representativeAttempt.createdAt}|${context.session.createdAt ?? ""}|${context.session.id}`;

export const summarizeRepresentativeRecords = ({
  students,
  sessions,
  records
}: {
  students: PAPSStudent[];
  sessions: PAPSSession[];
  records: PAPSAttemptRecord[];
}): {
  studentSummaries: PAPSRepresentativeStudentSummary[];
  officialSummaries: PAPSRepresentativeOfficialSummary[];
} => {
  const studentById = new Map(students.map((student) => [student.id, student]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const groupedContexts = new Map<string, RepresentativeRecordContext[]>();

  for (const record of records) {
    const student = studentById.get(record.studentId);
    const session = sessionById.get(record.sessionId);
    const representativeSelection = getRepresentativeAttempt(record, {
      fallbackToLatest: true
    });
    const representativeAttempt = representativeSelection.attempt;

    if (!student || !session || !representativeAttempt) {
      continue;
    }

    const key = `${record.studentId}:${record.eventId}`;
    const currentItems = groupedContexts.get(key) ?? [];

    currentItems.push({
      student,
      session,
      record,
      representativeAttempt,
      usedFallbackRepresentative: representativeSelection.usedFallbackRepresentative
    });
    groupedContexts.set(key, currentItems);
  }

  const studentSummaries: PAPSRepresentativeStudentSummary[] = [];
  const officialSummaries: PAPSRepresentativeOfficialSummary[] = [];

  for (const items of groupedContexts.values()) {
    items.sort((left, right) =>
      getSortableRepresentativeTimestamp(left).localeCompare(getSortableRepresentativeTimestamp(right))
    );

    const latest = items.at(-1);

    if (!latest) {
      continue;
    }

    const previous = items.at(-2);
    const latestSummary = summarizeStudentRecord({
      session: latest.session,
      student: latest.student,
      record: {
        ...latest.record,
        representativeAttemptId: latest.representativeAttempt.id
      },
      previousRepresentativeMeasurement: previous?.representativeAttempt.measurement
    });
    const eventDefinition = getEventDefinition(latest.record.eventId);
    const bestRepresentativeMeasurement = items.reduce((best, current) => {
      if (eventDefinition.betterDirection === "higher") {
        return Math.max(best, current.representativeAttempt.measurement);
      }

      return Math.min(best, current.representativeAttempt.measurement);
    }, items[0]!.representativeAttempt.measurement);

    studentSummaries.push({
      studentId: latest.student.id,
      studentName: latest.student.name,
      gradeLevel: latest.student.gradeLevel,
      classId: latest.student.classId,
      eventId: latest.record.eventId,
      latestRepresentativeMeasurement: latest.representativeAttempt.measurement,
      previousRepresentativeMeasurement: previous?.representativeAttempt.measurement ?? null,
      improvement: latestSummary.improvement,
      bestRepresentativeMeasurement,
      unit: latest.record.unit,
      latestMeasuredAt: latest.representativeAttempt.createdAt,
      latestSessionId: latest.session.id,
      latestSessionName: latest.session.name ?? latest.session.id,
      latestSessionType: latest.session.sessionType,
      officialGrade: latestSummary.officialGrade,
      message: formatSummaryMessage({
        sessionType: latest.session.sessionType,
        improvement: latestSummary.improvement,
        unit: latest.record.unit
      })
    });

    const latestOfficial = [...items]
      .reverse()
      .find((item) => item.session.sessionType === "official" && !item.usedFallbackRepresentative);

    if (!latestOfficial) {
      continue;
    }

    const officialSummary = summarizeStudentRecord({
      session: latestOfficial.session,
      student: latestOfficial.student,
      record: {
        ...latestOfficial.record,
        representativeAttemptId: latestOfficial.representativeAttempt.id
      }
    });

    officialSummaries.push({
      studentId: latestOfficial.student.id,
      studentName: latestOfficial.student.name,
      gradeLevel: latestOfficial.student.gradeLevel,
      classId: latestOfficial.student.classId,
      eventId: latestOfficial.record.eventId,
      representativeMeasurement: latestOfficial.representativeAttempt.measurement,
      unit: latestOfficial.record.unit,
      officialGrade: officialSummary.officialGrade ?? null,
      measuredAt: latestOfficial.representativeAttempt.createdAt,
      sessionId: latestOfficial.session.id,
      sessionName: latestOfficial.session.name ?? latestOfficial.session.id,
      note: "공식 기록 완료"
    });
  }

  return {
    studentSummaries,
    officialSummaries
  };
};

export const selectRepresentativeAttempt = (
  record: PAPSAttemptRecord,
  attemptId: string | null
): PAPSAttemptRecord => {
  if (attemptId === null) {
    return {
      ...record,
      representativeAttemptId: null
    };
  }

  if (!record.attempts.some((attempt) => attempt.id === attemptId)) {
    throw new Error(`Representative attempt ${attemptId} was not found in the record.`);
  }

  return {
    ...record,
    representativeAttemptId: attemptId
  };
};

export const summarizeStudentRecord = ({
  session,
  student,
  record,
  previousRepresentativeMeasurement
}: {
  session: PAPSSession;
  student: PAPSStudent;
  record: PAPSAttemptRecord;
  previousRepresentativeMeasurement?: number;
}): PAPSRecordSummary => {
  validateSummaryContext({
    session,
    student,
    record
  });

  const eventDefinition = getEventDefinition(record.eventId);
  const representativeSelection = getRepresentativeAttempt(record);
  const representativeAttempt = representativeSelection.attempt;
  const representativeMeasurement = representativeAttempt?.measurement ?? null;

  const summary: PAPSRecordSummary = {
    sessionId: session.id,
    studentId: student.id,
    eventId: record.eventId,
    unit: record.unit,
    sessionType: session.sessionType,
    attempts: record.attempts,
    representativeAttemptId: representativeAttempt?.id ?? null,
    representativeMeasurement,
    improvement: calculateImprovement({
      previousRepresentativeMeasurement,
      currentRepresentativeMeasurement: representativeMeasurement,
      betterDirection: eventDefinition.betterDirection
    })
  };

  if (session.sessionType === "official" && representativeMeasurement !== null) {
    summary.officialGrade = calculateOfficialGrade({
      gradeLevel: session.gradeLevel,
      sex: student.sex,
      eventId: record.eventId,
      measurement: representativeMeasurement
    });
  }

  return summary;
};
