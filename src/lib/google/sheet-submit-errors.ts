import { GoogleSheetsAccessError } from "./sheets-client";

export interface StudentSubmissionErrorResult {
  ok: false;
  error: string;
  status: number;
}

export const toStudentSubmissionSheetError = (
  error: unknown,
  fallbackMessage = "Could not submit the attempt."
): StudentSubmissionErrorResult => {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (message.includes("was not found")) return { ok: false, error: message, status: 404 };
  if (message === "Session is closed." || message === "Only the latest attempt can be edited.") return { ok: false, error: message, status: 409 };
  if (
    message === "Inactive students cannot submit attempts." ||
    message === "Student session access token does not match this session." ||
    message === "Attempt edit token does not match this submission." ||
    message.includes("must match") || message.includes("Students cannot") || message.includes("assigned to this session")
  ) return { ok: false, error: message, status: 400 };
  if (error instanceof GoogleSheetsAccessError) return { ok: false, error: message, status: 503 };
  if (message.startsWith("Append") || message.startsWith("Update")) return { ok: false, error: message, status: 409 };
  return { ok: false, error: message, status: 500 };
};
