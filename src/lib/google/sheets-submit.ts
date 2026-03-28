import { randomUUID } from "node:crypto";

import { getEventDefinition } from "../paps/catalog";
import { resolveSubmissionMeasurement } from "../paps/composite-measurements";
import { calculateOfficialGrade } from "../paps/grade";
import type {
  OfficialGrade,
  PAPSAttempt,
  PAPSMeasurementDetail,
  PAPSStoredAttempt
} from "../paps/types";
import {
  assertAttemptInputAllowed,
  assertMeasurementAllowed,
  assertMeasurementDetailAllowed
} from "../paps/validation";
import type { StudentSessionView } from "../store/paps-store-types";
import { buildStructuredStateFromSheet } from "./sheets-bootstrap";
import { createGoogleSheetClientFromEnv } from "./sheets-store";
import { GoogleSheetsAccessError, type GoogleSheetsClient } from "./sheets-client";
import { buildRecordNote } from "./sheets-record-note";
import { rebuildGoogleSheetSummaries } from "./sheets-rebuild";

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

const buildStudentSessionViewFromState = (
  state: Awaited<ReturnType<typeof buildStructuredStateFromSheet>>,
  sessionId: string
): StudentSessionView => {
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  const activeStudents = state.allStudents.filter((student) => student.active !== false);
  const classSections = session.classTargets.map((classTarget) => {
    const classroom = state.classes.find((entry) => entry.id === classTarget.classId);

    if (!classroom) {
      throw new Error(`Class ${classTarget.classId} was not found.`);
    }

    return {
      classId: classroom.id,
      label: classroom.label,
      students: activeStudents
        .filter((student) => student.classId === classroom.id)
        .sort((left, right) => {
          if (left.studentNumber !== undefined && right.studentNumber !== undefined) {
            return left.studentNumber - right.studentNumber;
          }

          return left.name.localeCompare(right.name, "en");
        })
        .map((student) => ({
          id: student.id,
          name: student.name
        }))
    };
  });

  return {
    session,
    classSections
  };
};

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
      detail: input.detail ?? null
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

export const loadStudentSessionViewFromSheet = async (input: {
  spreadsheetId: string;
  sessionId: string;
  client?: GoogleSheetsClient;
}): Promise<StudentSessionView> => {
  const state = await buildStructuredStateFromSheet({
    client: input.client ?? createGoogleSheetClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: STUDENT_RUNTIME_EMAIL
  });

  return buildStudentSessionViewFromState(state, input.sessionId);
};

export const appendStudentSubmissionToSheet = async (input: {
  spreadsheetId: string;
  sessionId: string;
  studentId: string;
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
  clientSubmissionKey: string;
  client?: GoogleSheetsClient;
}): Promise<
  | {
      ok: true;
      result: {
        student: {
          id: string;
          name: string;
        };
        attempts: PAPSAttempt[];
        latestOfficialGrade: OfficialGrade | null;
        summaryWarning?: string;
      };
    }
  | {
      ok: false;
      error: string;
      status: number;
    }
> => {
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
      session.sessionType === "official"
        ? calculateOfficialGrade({
            gradeLevel: session.gradeLevel,
            sex: student.sex,
            eventId: session.eventId,
            measurement: resolvedSubmission.measurement
          })
        : null;
    const appendedAttempt: PAPSAttempt = {
      id: randomUUID(),
      attemptNumber: rawAttempts.length + 1,
      measurement: resolvedSubmission.measurement,
      createdAt,
      clientSubmissionKey: input.clientSubmissionKey,
      detail: resolvedSubmission.detail
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
    const summaryRebuild = await rebuildGoogleSheetSummaries({
      spreadsheetId: input.spreadsheetId,
      teacherEmail: STUDENT_RUNTIME_EMAIL,
      client
    });

    return {
      ok: true,
      result: {
        student: {
          id: student.id,
          name: student.name
        },
        attempts: dedupeAttemptsByClientSubmissionKey([...rawAttempts, appendedAttempt]),
        latestOfficialGrade,
        ...(summaryRebuild.ok
          ? {}
          : {
              summaryWarning: summaryRebuild.error
            })
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit the attempt.";

    if (message.includes("was not found")) {
      return {
        ok: false,
        error: message,
        status: 404
      };
    }

    if (message === "Session is closed.") {
      return {
        ok: false,
        error: message,
        status: 409
      };
    }

    if (
      message === "Inactive students cannot submit attempts." ||
      message.includes("must match") ||
      message.includes("Students cannot") ||
      message.includes("assigned to this session")
    ) {
      return {
        ok: false,
        error: message,
        status: 400
      };
    }

    if (error instanceof GoogleSheetsAccessError) {
      return {
        ok: false,
        error: message,
        status: 503
      };
    }

    if (message.startsWith("Append")) {
      return {
        ok: false,
        error: message,
        status: 409
      };
    }

    return {
      ok: false,
      error: message,
      status: 500
    };
  }
};
