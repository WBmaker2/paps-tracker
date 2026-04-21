import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getNextAuthSecret, getStudentTeacherPin } from "./env";
import type { PAPSSchool, PAPSTeacherReturnPin } from "./paps/types";

const TEACHER_RETURN_PIN_PATTERN = /^\d{4,6}$/;
const TEACHER_RETURN_PIN_ALGORITHM = "hmac-sha256-v1" as const;

export const validateTeacherReturnPin = (pin: string): string | null => {
  const normalizedPin = pin.trim();

  if (!TEACHER_RETURN_PIN_PATTERN.test(normalizedPin)) {
    return "PIN은 4~6자리 숫자로 입력해주세요.";
  }

  return null;
};

const deriveTeacherReturnPinHash = (pin: string, salt: string): string => {
  const secret = getNextAuthSecret();

  if (!secret) {
    throw new Error("Teacher return PIN secret is not configured.");
  }

  return createHmac("sha256", secret)
    .update(`${salt}:${pin.trim()}`, "utf8")
    .digest("base64url");
};

export const createTeacherReturnPinConfig = ({
  pin,
  updatedByTeacherEmail,
  now = new Date()
}: {
  pin: string;
  updatedByTeacherEmail: string;
  now?: Date;
}): PAPSTeacherReturnPin => {
  const validationError = validateTeacherReturnPin(pin);

  if (validationError) {
    throw new Error(validationError);
  }

  const salt = randomBytes(16).toString("base64url");

  return {
    algorithm: TEACHER_RETURN_PIN_ALGORITHM,
    salt,
    hash: deriveTeacherReturnPinHash(pin, salt),
    updatedAt: now.toISOString(),
    updatedByTeacherEmail
  };
};

export const isSheetTeacherReturnPinConfigured = (
  teacherReturnPin?: PAPSTeacherReturnPin | null
): teacherReturnPin is PAPSTeacherReturnPin =>
  Boolean(
    teacherReturnPin?.algorithm === TEACHER_RETURN_PIN_ALGORITHM &&
      teacherReturnPin.salt &&
      teacherReturnPin.hash
  );

export const verifySheetTeacherReturnPin = (
  teacherReturnPin: PAPSTeacherReturnPin | null | undefined,
  candidatePin: string
): boolean => {
  if (!isSheetTeacherReturnPinConfigured(teacherReturnPin)) {
    return false;
  }

  const expectedBuffer = Buffer.from(teacherReturnPin.hash, "utf8");
  const candidateBuffer = Buffer.from(
    deriveTeacherReturnPinHash(candidatePin, teacherReturnPin.salt),
    "utf8"
  );

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
};

export const isTeacherReturnPinEnabled = (school?: PAPSSchool | null): boolean =>
  Boolean(isSheetTeacherReturnPinConfigured(school?.teacherReturnPin) || getStudentTeacherPin());

const verifyEnvTeacherReturnPin = (candidatePin: string): boolean => {
  const configuredPin = getStudentTeacherPin();

  if (!configuredPin) {
    return false;
  }

  const normalizedCandidate = candidatePin.trim();
  const expectedBuffer = Buffer.from(configuredPin, "utf8");
  const candidateBuffer = Buffer.from(normalizedCandidate, "utf8");

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, candidateBuffer);
};

export const verifyTeacherReturnPin = (
  candidatePin: string,
  school?: PAPSSchool | null
): boolean => {
  if (isSheetTeacherReturnPinConfigured(school?.teacherReturnPin)) {
    return verifySheetTeacherReturnPin(school?.teacherReturnPin, candidatePin);
  }

  return verifyEnvTeacherReturnPin(candidatePin);
};
