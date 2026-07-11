import { createHmac, timingSafeEqual } from "node:crypto";

import { getNextAuthSecret } from "../env";

const TEACHER_SHEET_INVITE_VERSION = 1;
export const TEACHER_SHEET_INVITE_TTL_MS = 15 * 60 * 1000;
export const INVALID_TEACHER_SHEET_INVITE_ERROR =
  "Invalid or expired teacher sheet invitation.";

type TeacherSheetInvitePayload = {
  v: number;
  spreadsheetId: string;
  inviterEmail: string;
  targetEmail: string;
  expiresAt: string;
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const getInviteSecret = (): string => {
  const secret = getNextAuthSecret();

  if (!secret) {
    throw new Error("Teacher sheet invitation secret is not configured.");
  }

  return secret;
};

const signPayload = (encodedPayload: string): Buffer =>
  createHmac("sha256", getInviteSecret()).update(encodedPayload).digest();

const invalidInvite = (): never => {
  throw new Error(INVALID_TEACHER_SHEET_INVITE_ERROR);
};

export const createTeacherSheetInviteToken = ({
  spreadsheetId,
  inviterEmail,
  targetEmail,
  now = new Date()
}: {
  spreadsheetId: string;
  inviterEmail: string;
  targetEmail: string;
  now?: Date;
}): string => {
  const normalizedSpreadsheetId = spreadsheetId.trim();
  const normalizedInviterEmail = normalizeEmail(inviterEmail);
  const normalizedTargetEmail = normalizeEmail(targetEmail);

  if (!normalizedSpreadsheetId || !normalizedInviterEmail || !normalizedTargetEmail) {
    throw new Error("Spreadsheet, inviter, and target teacher are required.");
  }

  const payload: TeacherSheetInvitePayload = {
    v: TEACHER_SHEET_INVITE_VERSION,
    spreadsheetId: normalizedSpreadsheetId,
    inviterEmail: normalizedInviterEmail,
    targetEmail: normalizedTargetEmail,
    expiresAt: new Date(now.getTime() + TEACHER_SHEET_INVITE_TTL_MS).toISOString()
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const encodedSignature = signPayload(encodedPayload).toString("base64url");

  return `${encodedPayload}.${encodedSignature}`;
};

export const resolveTeacherSheetInviteToken = (
  token: string,
  {
    spreadsheetId,
    targetEmail,
    now = new Date()
  }: {
    spreadsheetId: string;
    targetEmail: string;
    now?: Date;
  }
): TeacherSheetInvitePayload => {
  const [encodedPayload, encodedSignature] = token.trim().split(".");

  if (!encodedPayload || !encodedSignature) {
    return invalidInvite();
  }

  const expectedSignature = signPayload(encodedPayload);
  const actualSignature = Buffer.from(encodedSignature, "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    return invalidInvite();
  }

  let payload: Partial<TeacherSheetInvitePayload>;

  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<TeacherSheetInvitePayload>;
  } catch {
    return invalidInvite();
  }

  if (
    payload.v !== TEACHER_SHEET_INVITE_VERSION ||
    payload.spreadsheetId !== spreadsheetId.trim() ||
    normalizeEmail(payload.targetEmail ?? "") !== normalizeEmail(targetEmail) ||
    !payload.inviterEmail ||
    !payload.expiresAt ||
    Number.isNaN(Date.parse(payload.expiresAt)) ||
    Date.parse(payload.expiresAt) <= now.getTime()
  ) {
    return invalidInvite();
  }

  return {
    v: payload.v,
    spreadsheetId: payload.spreadsheetId,
    inviterEmail: normalizeEmail(payload.inviterEmail),
    targetEmail: normalizeEmail(payload.targetEmail ?? ""),
    expiresAt: payload.expiresAt
  };
};
