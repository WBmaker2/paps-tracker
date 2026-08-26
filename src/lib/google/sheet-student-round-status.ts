import type {
  PAPSStudentRoundSubmitFinalizedResult,
  PAPSStudentRoundSubmitProgress
} from "../paps/types";
import { buildRoundSubmitExtras } from "./sheet-round-submit-view";
import {
  buildStructuredStateFromSheet,
  type GoogleSheetStructuredState
} from "./sheets-bootstrap";
import type { GoogleSheetsClient } from "./sheets-client";
import { createGoogleSheetClientFromEnv } from "./sheets-store";

const STUDENT_RUNTIME_EMAIL = "student-session@paps.local";

export interface StudentRoundStatusFromSheet {
  student: {
    id: string;
    name: string;
  };
  roundProgress: PAPSStudentRoundSubmitProgress;
  finalizedResult: PAPSStudentRoundSubmitFinalizedResult | null;
}

const findAssessmentSession = (
  state: GoogleSheetStructuredState,
  sessionGroupId: string
) =>
  state.sessions
    .filter(
      (session) =>
        session.sessionGroupId === sessionGroupId &&
        Boolean(session.assessmentRoundId && session.factorId)
    )
    .sort(
      (left, right) =>
        (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
        left.id.localeCompare(right.id)
    )[0] ?? null;

export const loadStudentRoundStatusFromSheet = async (input: {
  spreadsheetId: string;
  sessionGroupId: string;
  studentId: string;
  client?: GoogleSheetsClient;
}): Promise<StudentRoundStatusFromSheet> => {
  const state = await buildStructuredStateFromSheet({
    client: input.client ?? createGoogleSheetClientFromEnv(),
    spreadsheetId: input.spreadsheetId,
    teacherEmail: STUDENT_RUNTIME_EMAIL
  });
  const assessmentSession = findAssessmentSession(state, input.sessionGroupId);

  if (!assessmentSession) {
    throw new Error("Assessment session group was not found.");
  }

  const targetClassIds = new Set(
    state.sessions
      .filter((session) => session.sessionGroupId === input.sessionGroupId)
      .flatMap((session) => session.classTargets.map((target) => target.classId))
  );
  const student = state.allStudents.find(
    (entry) =>
      entry.id === input.studentId &&
      entry.active !== false &&
      targetClassIds.has(entry.classId)
  );

  if (!student) {
    throw new Error("Student was not found in this session group.");
  }

  const extras = buildRoundSubmitExtras({
    state,
    sessionId: assessmentSession.id,
    studentId: student.id,
    studentName: student.name
  });

  if (!extras.roundProgress) {
    throw new Error("Assessment round status was not found.");
  }

  return {
    student: {
      id: student.id,
      name: student.name
    },
    roundProgress: extras.roundProgress,
    finalizedResult: extras.finalizedResult ?? null
  };
};
