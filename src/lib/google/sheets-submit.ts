import { randomUUID } from "node:crypto";

import { getEventDefinition, hasOfficialGradeRule } from "../paps/catalog";
import {
  formatAttemptDetailSummary,
  resolveSubmissionMeasurement
} from "../paps/composite-measurements";
import { calculateOfficialGrade } from "../paps/grade";
import type {
  OfficialGrade,
  PAPSAttempt,
  PAPSMeasurementDetail,
  PAPSStudentEventHistoryAttempt,
  PAPSStoredAttempt
  , PAPSStudentRoundSubmitProgress, PAPSStudentRoundSubmitFinalizedResult
} from "../paps/types";
import {
  assertAttemptInputAllowed,
  assertMeasurementAllowed,
  assertMeasurementDetailAllowed
} from "../paps/validation";
import { buildStructuredStateFromSheet } from "./sheets-bootstrap";
import { createGoogleSheetClientFromEnv } from "./sheets-store";
import { type GoogleSheetsClient } from "./sheets-client";
import { buildRecordNote } from "./sheets-record-note";
import { persistStudentSubmissionSummaryRows } from "./sheet-summary-row-persistence";
import { writeGoogleSheetRecordSourceTab } from "./sheet-source-write";
import { buildStudentEventHistoryAttempts } from "./sheet-student-session-views";
import { buildRoundSubmitExtras } from "./sheet-round-submit-view";
import { toStudentSubmissionSheetError } from "./sheet-submit-errors";

export {
  loadStudentSessionGroupViewFromSheet,
  loadStudentSessionViewFromSheet
} from "./sheet-student-session-views";

const STUDENT_RUNTIME_EMAIL = "student-session@paps.local";
const RECORD_APPEND_RANGE = "'세션기록'!A:U";

const formatIsoDate = (value: string): string => value.slice(0, 10);

const formatIsoDateTime = (value: string): string => value.slice(0, 19).replace("T", " ");

const toSessionTypeLabel = (sessionType: "official" | "practice"): string =>
  sessionType === "official" ? "공식" : "연습";

const toScopeLabel = (classScope: "single" | "split"): string =>
  classScope === "split" ? "2반 분할형" : "1반형";

const sortAttempts = (attempts: PAPSAttempt[]): PAPSAttempt[] =>
  [...attempts].sort((left, right) => {
    if (left.attemptNumber !== right.attemptNumber) {
      return left.attemptNumber - right.attemptNumber;
    }

    return left.createdAt.localeCompare(right.createdAt);
  });

const toStudentAttempt = (attempt: PAPSStoredAttempt): PAPSAttempt => ({
  id: attempt.id,
  attemptNumber: attempt.attemptNumber,
  measurement: attempt.measurement,
  createdAt: attempt.createdAt,
  clientSubmissionKey: attempt.clientSubmissionKey,
  detail: attempt.detail ?? null
});

const buildAttemptRow = (input: {
  state: Awaited<ReturnType<typeof buildStructuredStateFromSheet>>;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
  attemptId: string;
  attemptNumber: number;
  clientSubmissionKey: string;
  latestOfficialGrade: OfficialGrade | null;
  detail?: PAPSMeasurementDetail | null;
}): string[] => {
  const session = input.state.sessions.find((entry) => entry.id === input.sessionId);
  const student = input.state.allStudents.find((entry) => entry.id === input.studentId);

  if (!session || !student) {
    throw new Error("The session or student could not be found.");
  }

  const targetClassLabels = session.classTargets
    .map((target) => input.state.classes.find((entry) => entry.id === target.classId)?.label ?? target.classId)
    .join("+");
  const primaryClass = input.state.classes.find((entry) => entry.id === student.classId) ?? null;
  const eventDefinition = getEventDefinition(session.eventId);

  return [
    input.attemptId,
    session.id,
    session.name ?? session.id,
    String(session.academicYear ?? primaryClass?.academicYear ?? ""),
    formatIsoDate(input.createdAt),
    toSessionTypeLabel(session.sessionType),
    toScopeLabel(session.classScope),
    targetClassLabels,
    String(primaryClass?.classNumber ?? ""),
    eventDefinition.label,
    eventDefinition.unit,
    student.id,
    student.name,
    String(input.attemptNumber),
    String(input.measurement),
    "N",
    "",
    input.latestOfficialGrade !== null ? String(input.latestOfficialGrade) : "",
    formatIsoDateTime(input.createdAt),
    "완료",
    buildRecordNote({
      clientSubmissionKey: input.clientSubmissionKey,
      detail: input.detail ?? null,
      detailSummary: formatAttemptDetailSummary({
        eventId: session.eventId,
        detail: input.detail ?? null
      })
    })
  ];
};
export const dedupeAttemptsByClientSubmissionKey = (attempts: PAPSAttempt[]): PAPSAttempt[] => {
  const seenKeys = new Set<string>();

  return sortAttempts(attempts).filter((attempt) => {
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

type StudentSubmissionSheetResult =
  | {
      ok: true;
      result: {
        student: {
          id: string;
          name: string;
        };
        attempts: PAPSAttempt[];
        historyAttempts?: PAPSStudentEventHistoryAttempt[];
        latestOfficialGrade: OfficialGrade | null;
        roundProgress?: PAPSStudentRoundSubmitProgress;
        finalizedResult?: PAPSStudentRoundSubmitFinalizedResult | null;
        summaryWarning?: string;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

export const appendStudentSubmissionToSheet = async (input: {
  spreadsheetId: string;
  sessionId: string;
  studentId: string;
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
  clientSubmissionKey: string;
  authorizedSessionGroupId?: string | null;
  client?: GoogleSheetsClient;
}): Promise<StudentSubmissionSheetResult> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();

  try {
    const state = await buildStructuredStateFromSheet({
      client,
      spreadsheetId: input.spreadsheetId,
      teacherEmail: STUDENT_RUNTIME_EMAIL
    });
    const session = state.sessions.find((entry) => entry.id === input.sessionId);

    if (!session) {
      throw new Error(`Session ${input.sessionId} was not found.`);
    }

    if (session.isOpen === false) {
      throw new Error("Session is closed.");
    }

    if (
      input.authorizedSessionGroupId &&
      session.sessionGroupId !== input.authorizedSessionGroupId
    ) {
      throw new Error("Student session access token does not match this session.");
    }

    const student = state.allStudents.find((entry) => entry.id === input.studentId);

    if (!student) {
      throw new Error(`Student ${input.studentId} was not found.`);
    }

    if (student.active === false) {
      throw new Error("Inactive students cannot submit attempts.");
    }

    const resolvedSubmission = resolveSubmissionMeasurement({
      eventId: session.eventId,
      measurement: input.measurement,
      detail: input.detail ?? null
    });

    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: resolvedSubmission.measurement,
        detail: resolvedSubmission.detail,
        submittedEventId: session.eventId,
        submittedSessionType: session.sessionType
      }
    });
    assertMeasurementDetailAllowed({
      eventId: session.eventId,
      detail: resolvedSubmission.detail
    });
    assertMeasurementAllowed({
      eventId: session.eventId,
      measurement: resolvedSubmission.measurement
    });

    const rawAttempts = sortAttempts(
      state.attempts
        .filter(
          (attempt) =>
            attempt.sessionId === input.sessionId && attempt.studentId === input.studentId
        )
        .map(toStudentAttempt)
    );
    const createdAt = new Date().toISOString();
    const latestOfficialGrade =
      session.sessionType === "official" &&
      hasOfficialGradeRule(session.eventId, student.gradeLevel, student.sex)
        ? calculateOfficialGrade({
            gradeLevel: student.gradeLevel,
            sex: student.sex,
            eventId: session.eventId,
            measurement: resolvedSubmission.measurement
          })
        : null;
    const appendedStoredAttempt: PAPSStoredAttempt = {
      id: randomUUID(),
      sessionId: input.sessionId,
      studentId: input.studentId,
      eventId: session.eventId,
      unit: getEventDefinition(session.eventId).unit,
      attemptNumber: rawAttempts.length + 1,
      measurement: resolvedSubmission.measurement,
      createdAt,
      clientSubmissionKey: input.clientSubmissionKey,
      detail: resolvedSubmission.detail
    };
    const appendedAttempt = toStudentAttempt(appendedStoredAttempt);
    const nextState = {
      ...state,
      attempts: [...state.attempts, appendedStoredAttempt]
    };

    await client.appendRows(input.spreadsheetId, RECORD_APPEND_RANGE, [
      buildAttemptRow({
        state,
        sessionId: input.sessionId,
        studentId: input.studentId,
        measurement: resolvedSubmission.measurement,
        createdAt,
        attemptId: appendedAttempt.id,
        attemptNumber: appendedAttempt.attemptNumber,
        clientSubmissionKey: input.clientSubmissionKey,
        latestOfficialGrade,
        detail: resolvedSubmission.detail
      })
    ]);
    const summaryRebuild = await persistStudentSubmissionSummaryRows({
      spreadsheetId: input.spreadsheetId,
      state: nextState,
      sessionId: input.sessionId,
      studentId: input.studentId,
      client
    });
    const roundExtras = buildRoundSubmitExtras({ state: nextState, sessionId: input.sessionId, studentId: input.studentId, studentName: student.name });
    const roundSession = state.sessions.find((entry) => entry.id === input.sessionId)?.assessmentRoundId;

    return {
      ok: true,
      result: {
        student: {
          id: student.id,
          name: student.name
        },
        attempts: dedupeAttemptsByClientSubmissionKey([...rawAttempts, appendedAttempt]),
        ...(roundSession ? roundExtras : { historyAttempts: buildStudentEventHistoryAttempts({ state: nextState, sessionId: input.sessionId, studentId: input.studentId }) }),
        latestOfficialGrade,
        ...(summaryRebuild.ok
          ? {}
          : {
              summaryWarning: summaryRebuild.error
            })
      }
    };
  } catch (error) {
    return toStudentSubmissionSheetError(error);
  }
};

export const updateStudentSubmissionInSheet = async (input: {
  spreadsheetId: string;
  sessionId: string;
  studentId: string;
  attemptId: string;
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
  clientSubmissionKey: string;
  authorizedSessionGroupId?: string | null;
  client?: GoogleSheetsClient;
}): Promise<StudentSubmissionSheetResult> => {
  const client = input.client ?? createGoogleSheetClientFromEnv();

  try {
    const state = await buildStructuredStateFromSheet({
      client,
      spreadsheetId: input.spreadsheetId,
      teacherEmail: STUDENT_RUNTIME_EMAIL
    });
    const session = state.sessions.find((entry) => entry.id === input.sessionId);

    if (!session) {
      throw new Error(`Session ${input.sessionId} was not found.`);
    }

    if (session.isOpen === false) {
      throw new Error("Session is closed.");
    }

    if (
      input.authorizedSessionGroupId &&
      session.sessionGroupId !== input.authorizedSessionGroupId
    ) {
      throw new Error("Student session access token does not match this session.");
    }

    const student = state.allStudents.find((entry) => entry.id === input.studentId);

    if (!student) {
      throw new Error(`Student ${input.studentId} was not found.`);
    }

    if (student.active === false) {
      throw new Error("Inactive students cannot submit attempts.");
    }

    const resolvedSubmission = resolveSubmissionMeasurement({
      eventId: session.eventId,
      measurement: input.measurement,
      detail: input.detail ?? null
    });

    assertAttemptInputAllowed({
      session,
      student,
      input: {
        measurement: resolvedSubmission.measurement,
        detail: resolvedSubmission.detail,
        submittedEventId: session.eventId,
        submittedSessionType: session.sessionType
      }
    });
    assertMeasurementDetailAllowed({
      eventId: session.eventId,
      detail: resolvedSubmission.detail
    });
    assertMeasurementAllowed({
      eventId: session.eventId,
      measurement: resolvedSubmission.measurement
    });

    const attemptsForRecord = sortAttempts(
      state.attempts
        .filter(
          (attempt) =>
            attempt.sessionId === input.sessionId && attempt.studentId === input.studentId
        )
        .map(toStudentAttempt)
    );
    const latestAttempt = attemptsForRecord.at(-1) ?? null;
    const existingAttempt =
      attemptsForRecord.find((attempt) => attempt.id === input.attemptId) ?? null;

    if (!existingAttempt) {
      throw new Error(`Attempt ${input.attemptId} was not found.`);
    }

    if (latestAttempt?.id !== existingAttempt.id) {
      throw new Error("Only the latest attempt can be edited.");
    }

    if (
      existingAttempt.clientSubmissionKey &&
      existingAttempt.clientSubmissionKey !== input.clientSubmissionKey
    ) {
      throw new Error("Attempt edit token does not match this submission.");
    }

    const latestOfficialGrade =
      session.sessionType === "official" &&
      hasOfficialGradeRule(session.eventId, student.gradeLevel, student.sex)
        ? calculateOfficialGrade({
            gradeLevel: student.gradeLevel,
            sex: student.sex,
            eventId: session.eventId,
            measurement: resolvedSubmission.measurement
          })
        : null;
    const updatedAttempts: PAPSStoredAttempt[] = state.attempts.map((attempt) =>
      attempt.id === input.attemptId
        ? {
            ...attempt,
            measurement: resolvedSubmission.measurement,
            detail: resolvedSubmission.detail,
            clientSubmissionKey: attempt.clientSubmissionKey ?? input.clientSubmissionKey
          }
        : attempt
    );
    const nextState = {
      ...state,
      attempts: updatedAttempts
    };

    await writeGoogleSheetRecordSourceTab({
      spreadsheetId: input.spreadsheetId,
      client,
      state: nextState
    });
    const summaryRebuild = await persistStudentSubmissionSummaryRows({
      spreadsheetId: input.spreadsheetId,
      state: nextState,
      sessionId: input.sessionId,
      studentId: input.studentId,
      client
    });
    const roundExtras = buildRoundSubmitExtras({ state: nextState, sessionId: input.sessionId, studentId: input.studentId, studentName: student.name });
    const roundSession = state.sessions.find((entry) => entry.id === input.sessionId)?.assessmentRoundId;

    return {
      ok: true,
      result: {
        student: {
          id: student.id,
          name: student.name
        },
        attempts: dedupeAttemptsByClientSubmissionKey(
          sortAttempts(
            updatedAttempts
              .filter(
                (attempt) =>
                  attempt.sessionId === input.sessionId && attempt.studentId === input.studentId
              )
              .map(toStudentAttempt)
          )
        ),
        ...(roundSession ? roundExtras : { historyAttempts: buildStudentEventHistoryAttempts({ state: nextState, sessionId: input.sessionId, studentId: input.studentId }) }),
        latestOfficialGrade,
        ...(summaryRebuild.ok
          ? {}
          : {
              summaryWarning: summaryRebuild.error
            })
      }
    };
  } catch (error) {
    return toStudentSubmissionSheetError(error);
  }
};
