import type { RecordSelector } from "../store/paps-store-types";

export const createRecordId = ({ sessionId, studentId }: RecordSelector): string =>
  `${sessionId}:${studentId}`;

export const parseRecordId = (recordId: string): RecordSelector => {
  const [sessionId, studentId] = recordId.split(":");

  if (!sessionId || !studentId) {
    throw new Error(`Record id ${recordId} is invalid.`);
  }

  return {
    sessionId,
    studentId
  };
};
