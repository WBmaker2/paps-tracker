import { timingSafeEqual } from "node:crypto";

import { getStudentTeacherPin } from "./env";

export const isTeacherReturnPinEnabled = (): boolean => Boolean(getStudentTeacherPin());

export const verifyTeacherReturnPin = (candidatePin: string): boolean => {
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
