import { getEventDefinition, isEventEligibleForGrade, supportsSessionType } from "./catalog";
import type {
  PAPSAttemptDraft,
  PAPSAttemptRecord,
  PAPSSession,
  PAPSStudent,
  PAPSSubmissionInput
} from "./types";

export const validateSession = (session: PAPSSession): PAPSSession => {
  if (session.classScope === "single" && session.classTargets.length !== 1) {
    throw new Error("Single-class sessions must target exactly one class.");
  }

  if (
    session.classScope === "single" &&
    session.classTargets[0]?.eventId !== session.eventId
  ) {
    throw new Error("Single-class sessions must use the configured session event.");
  }

  if (session.classScope === "split" && session.classTargets.length !== 2) {
    throw new Error("Split sessions must target exactly two classes.");
  }

  if (
    session.classScope === "split" &&
    session.classTargets[0]?.classId === session.classTargets[1]?.classId
  ) {
    throw new Error("Split sessions must target two different classes.");
  }

  if (
    session.classScope === "split" &&
    session.classTargets.some((classTarget) => classTarget.eventId !== session.eventId)
  ) {
    throw new Error("Split sessions must use the same event for both classes.");
  }

  if (!supportsSessionType(session.eventId, session.sessionType)) {
    throw new Error(`Event ${session.eventId} does not support ${session.sessionType} sessions.`);
  }

  if (!isEventEligibleForGrade(session.eventId, session.gradeLevel)) {
    throw new Error(`Event ${session.eventId} is not eligible for grade ${session.gradeLevel}.`);
  }

  return session;
};

export const assertAttemptInputAllowed = ({
  session,
  student,
  input
}: {
  session: PAPSSession;
  student: PAPSStudent;
  input: PAPSSubmissionInput;
}): void => {
  validateSession(session);

  if (student.gradeLevel !== session.gradeLevel) {
    throw new Error("Student grade must match the session grade.");
  }

  if (!session.classTargets.some((classTarget) => classTarget.classId === student.classId)) {
    throw new Error("Student class is not assigned to this session.");
  }

  if (input.submittedEventId && input.submittedEventId !== session.eventId) {
    throw new Error("Students cannot submit a different event than the session event.");
  }

  if (input.submittedSessionType && input.submittedSessionType !== session.sessionType) {
    throw new Error("Students cannot submit a different session type than the session type.");
  }
};

export const createAttemptRecord = (
  session: PAPSSession,
  student: PAPSStudent
): PAPSAttemptRecord => {
  validateSession(session);
  assertAttemptInputAllowed({
    session,
    student,
    input: {
      measurement: 0
    }
  });

  return {
    sessionId: session.id,
    studentId: student.id,
    eventId: session.eventId,
    unit: getEventDefinition(session.eventId).unit,
    attempts: [],
    representativeAttemptId: null
  };
};

export const appendAttempt = (
  record: PAPSAttemptRecord,
  draft: PAPSAttemptDraft
): PAPSAttemptRecord => ({
  ...record,
  attempts: [
    ...record.attempts,
    {
      id: draft.id,
      attemptNumber: record.attempts.length + 1,
      measurement: draft.measurement,
      createdAt: draft.createdAt
    }
  ]
});
