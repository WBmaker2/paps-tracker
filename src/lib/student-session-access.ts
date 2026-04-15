import { createHmac, timingSafeEqual } from "node:crypto";

import { getNextAuthSecret } from "./env";

const STUDENT_SESSION_ACCESS_VERSION = 1;

interface StudentSessionAccessPayload {
  v: number;
  sessionId: string;
  spreadsheetId: string;
}

const INVALID_TOKEN_ERROR = "Invalid student session access token.";
const MISMATCHED_SESSION_ERROR = "Student session access token does not match this session.";

const getStudentSessionAccessSecret = (): string => {
  const secret = getNextAuthSecret();

  if (!secret) {
    throw new Error("Student session access secret is not configured.");
  }

  return secret;
};

const signStudentSessionAccessPayload = (encodedPayload: string): Buffer =>
  createHmac("sha256", getStudentSessionAccessSecret()).update(encodedPayload).digest();

const parseStudentSessionAccessPayload = (encodedPayload: string): StudentSessionAccessPayload => {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<StudentSessionAccessPayload>;

    if (
      parsed.v !== STUDENT_SESSION_ACCESS_VERSION ||
      typeof parsed.sessionId !== "string" ||
      !parsed.sessionId.trim() ||
      typeof parsed.spreadsheetId !== "string" ||
      !parsed.spreadsheetId.trim()
    ) {
      throw new Error(INVALID_TOKEN_ERROR);
    }

    return {
      v: parsed.v,
      sessionId: parsed.sessionId,
      spreadsheetId: parsed.spreadsheetId
    };
  } catch (error) {
    if (error instanceof Error && error.message === INVALID_TOKEN_ERROR) {
      throw error;
    }

    throw new Error(INVALID_TOKEN_ERROR);
  }
};

export const createStudentSessionAccessToken = (input: {
  sessionId: string;
  spreadsheetId: string;
}): string => {
  const encodedPayload = Buffer.from(
    JSON.stringify({
      v: STUDENT_SESSION_ACCESS_VERSION,
      sessionId: input.sessionId,
      spreadsheetId: input.spreadsheetId
    } satisfies StudentSessionAccessPayload)
  ).toString("base64url");
  const encodedSignature = signStudentSessionAccessPayload(encodedPayload).toString("base64url");

  return `${encodedPayload}.${encodedSignature}`;
};

export const resolveStudentSessionAccess = (input: {
  token: string;
  sessionId: string;
}): {
  spreadsheetId: string;
} => {
  const [encodedPayload, encodedSignature] = input.token.split(".");

  if (!encodedPayload || !encodedSignature) {
    throw new Error(INVALID_TOKEN_ERROR);
  }

  const expectedSignature = signStudentSessionAccessPayload(encodedPayload);
  const actualSignature = Buffer.from(encodedSignature, "base64url");

  if (
    expectedSignature.length !== actualSignature.length ||
    !timingSafeEqual(expectedSignature, actualSignature)
  ) {
    throw new Error(INVALID_TOKEN_ERROR);
  }

  const payload = parseStudentSessionAccessPayload(encodedPayload);

  if (payload.sessionId !== input.sessionId) {
    throw new Error(MISMATCHED_SESSION_ERROR);
  }

  return {
    spreadsheetId: payload.spreadsheetId
  };
};

export const createStudentSessionUrl = (input: {
  sessionId: string;
  spreadsheetId: string;
}): string => {
  const accessToken = createStudentSessionAccessToken(input);

  return `/session/${encodeURIComponent(input.sessionId)}?access=${encodeURIComponent(accessToken)}`;
};
