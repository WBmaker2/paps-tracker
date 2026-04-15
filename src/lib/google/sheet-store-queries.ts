import type { PAPSClassroom, PAPSSession, PAPSStudent } from "../paps/types";
import type { GoogleSheetStructuredState } from "./sheets-bootstrap";

export const getGoogleSheetClass = (
  state: GoogleSheetStructuredState,
  classId: string
): PAPSClassroom => {
  const classroom = state.classes.find((entry) => entry.id === classId);

  if (!classroom) {
    throw new Error(`Class ${classId} was not found.`);
  }

  return classroom;
};

export const getGoogleSheetStudent = (
  state: GoogleSheetStructuredState,
  studentId: string
): PAPSStudent => {
  const student = state.allStudents.find((entry) => entry.id === studentId);

  if (!student) {
    throw new Error(`Student ${studentId} was not found.`);
  }

  return student;
};

export const getGoogleSheetSession = (
  state: GoogleSheetStructuredState,
  sessionId: string
): PAPSSession => {
  const session = state.sessions.find((entry) => entry.id === sessionId);

  if (!session) {
    throw new Error(`Session ${sessionId} was not found.`);
  }

  return session;
};
