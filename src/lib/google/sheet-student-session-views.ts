import type {
  PAPSStudentEventHistoryAttempt,
  PAPSStoredAttempt
} from "../paps/types";
import type { StudentSessionGroupView, StudentSessionView } from "../store/paps-store-types";
import { isTeacherReturnPinEnabled } from "../teacher-return";
import {
  buildStructuredStateFromSheet,
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import { createGoogleSheetClientFromEnv } from "./sheets-store";

const STUDENT_RUNTIME_EMAIL = "student-session@paps.local";

const toStudentAttempt = (attempt: PAPSStoredAttempt) => ({
  id: attempt.id,
  attemptNumber: attempt.attemptNumber,
  measurement: attempt.measurement,
  createdAt: attempt.createdAt,
  clientSubmissionKey: attempt.clientSubmissionKey,
  detail: attempt.detail ?? null
});

const sortHistoryAttempts = (
  attempts: PAPSStudentEventHistoryAttempt[]
): PAPSStudentEventHistoryAttempt[] =>
  [...attempts].sort((left, right) => {
    if (left.sessionId === right.sessionId) {
      return (
        left.attemptNumber - right.attemptNumber ||
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.localeCompare(right.id)
      );
    }

    return (
      left.createdAt.localeCompare(right.createdAt) ||
      left.sessionId.localeCompare(right.sessionId) ||
      left.attemptNumber - right.attemptNumber ||
      left.id.localeCompare(right.id)
    );
  });

const dedupeHistoryAttempts = (
  attempts: PAPSStudentEventHistoryAttempt[]
): PAPSStudentEventHistoryAttempt[] => {
  const seenKeys = new Set<string>();

  return sortHistoryAttempts(attempts).filter((attempt) => {
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

export const buildStudentEventHistoryAttempts = ({
  state,
  sessionId,
  studentId
}: {
  state: GoogleSheetStructuredState;
  sessionId: string;
  studentId: string;
}): PAPSStudentEventHistoryAttempt[] => {
  const currentSession = state.sessions.find((entry) => entry.id === sessionId);

  if (!currentSession) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  return dedupeHistoryAttempts(
    state.attempts.flatMap((attempt) => {
      if (attempt.studentId !== studentId || attempt.eventId !== currentSession.eventId) {
        return [];
      }

      const session = state.sessions.find((entry) => entry.id === attempt.sessionId);

      if (!session) {
        return [];
      }

      if (
        currentSession.academicYear !== undefined &&
        session.academicYear !== undefined &&
        currentSession.academicYear !== session.academicYear
      ) {
        return [];
      }

      return [
        {
          ...toStudentAttempt(attempt),
          sessionId: session.id,
          sessionName: session.name ?? session.id,
          sessionType: session.sessionType,
          eventId: attempt.eventId,
          academicYear: session.academicYear,
          isCurrentSession: session.id === sessionId
        }
      ];
    })
  );
};

const buildStudentSessionView = (
  state: GoogleSheetStructuredState,
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
        .map((student) => ({ id: student.id, name: student.name }))
    };
  });

  return {
    session,
    classSections,
    teacherReturnPinConfigured: isTeacherReturnPinEnabled(state.school)
  };
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

  return buildStudentSessionView(state, input.sessionId);
};

export const loadStudentSessionGroupViewFromSheet = async (input: {
  spreadsheetId: string;
  sessionGroupId: string;
  client?: GoogleSheetsClient;
}): Promise<StudentSessionGroupView> => {
  const state = await buildStructuredStateFromSheet({
    client: input.client ?? createGoogleSheetClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: STUDENT_RUNTIME_EMAIL
  });
  const sessions = state.sessions
    .filter((session) => session.sessionGroupId === input.sessionGroupId)
    .sort(
      (left, right) =>
        (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
        (left.createdAt ?? "").localeCompare(right.createdAt ?? "") ||
        left.id.localeCompare(right.id)
    );

  if (sessions.length === 0) {
    throw new Error(`Session group ${input.sessionGroupId} was not found.`);
  }

  return {
    groupId: input.sessionGroupId,
    groupName: sessions[0]?.sessionGroupName ?? sessions[0]?.name ?? input.sessionGroupId,
    sessions: sessions.map((session) => buildStudentSessionView(state, session.id)),
    teacherReturnPinConfigured: isTeacherReturnPinEnabled(state.school)
  };
};
