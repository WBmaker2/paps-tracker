import { NextRequest, NextResponse } from "next/server";

import { buildStructuredStateFromSheet } from "../../../../src/lib/google/sheets-bootstrap";
import { createGoogleSheetClientFromEnv } from "../../../../src/lib/google/sheets-store";
import { getTeacherSession } from "../../../../src/lib/teacher-auth";
import type { PAPSSchool } from "../../../../src/lib/paps/types";
import { isTeacherReturnPinEnabled, verifyTeacherReturnPin } from "../../../../src/lib/teacher-return";
import { resolveStudentSessionAccessToken } from "../../../../src/lib/student-session-access";

const PIN_UNAVAILABLE_ERROR = "교사용 돌아가기 PIN이 아직 설정되지 않았습니다.";
const PIN_INVALID_ERROR = "교사용 PIN이 올바르지 않습니다.";
const PIN_CONTEXT_ERROR = "교사용 PIN 설정을 확인하지 못했습니다.";
const STUDENT_RUNTIME_EMAIL = "student-session@paps.local";
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30_000;
const failedPinAttempts = new Map<string, { count: number; lockUntil: number }>();

const createRateLimitKey = (request: NextRequest, accessToken: string): string => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();

  return `${accessToken || "legacy-env"}:${forwardedFor || "unknown-client"}`;
};

const getRemainingLockSeconds = (key: string): number => {
  const entry = failedPinAttempts.get(key);

  if (!entry?.lockUntil) {
    return 0;
  }

  const remainingMs = entry.lockUntil - Date.now();

  if (remainingMs <= 0) {
    failedPinAttempts.delete(key);
    return 0;
  }

  return Math.ceil(remainingMs / 1000);
};

const recordFailedAttempt = (key: string): number => {
  const current = failedPinAttempts.get(key);
  const nextCount = (current?.count ?? 0) + 1;

  failedPinAttempts.set(key, {
    count: nextCount >= MAX_FAILED_ATTEMPTS ? 0 : nextCount,
    lockUntil: nextCount >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCK_DURATION_MS : 0
  });

  return Math.max(0, MAX_FAILED_ATTEMPTS - nextCount);
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | {
        pin?: unknown;
        accessToken?: unknown;
      }
    | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
  const rateLimitKey = createRateLimitKey(request, accessToken);
  const remainingLockSeconds = getRemainingLockSeconds(rateLimitKey);
  let school: PAPSSchool | null = null;

  if (remainingLockSeconds > 0) {
    return NextResponse.json(
      { error: `PIN 입력이 잠겨 있습니다. ${remainingLockSeconds}초 뒤 다시 시도해주세요.` },
      { status: 429 }
    );
  }

  if (accessToken) {
    try {
      const accessPayload = resolveStudentSessionAccessToken(accessToken);
      const state = await buildStructuredStateFromSheet({
        client: createGoogleSheetClientFromEnv(),
        spreadsheetId: accessPayload.spreadsheetId,
        teacherEmail: STUDENT_RUNTIME_EMAIL
      });

      school = state.school;
    } catch {
      return NextResponse.json({ error: PIN_CONTEXT_ERROR }, { status: 400 });
    }
  }

  if (!isTeacherReturnPinEnabled(school)) {
    return NextResponse.json({ error: PIN_UNAVAILABLE_ERROR }, { status: 503 });
  }

  if (!verifyTeacherReturnPin(pin, school)) {
    const remainingAttempts = recordFailedAttempt(rateLimitKey);

    return NextResponse.json(
      {
        error:
          remainingAttempts > 0
            ? `${PIN_INVALID_ERROR} (${remainingAttempts}회 남음)`
            : "PIN 입력이 5회 틀려서 30초 동안 잠겼습니다."
      },
      { status: remainingAttempts > 0 ? 401 : 429 }
    );
  }

  failedPinAttempts.delete(rateLimitKey);
  const teacherSession = await getTeacherSession();

  return NextResponse.json({
    nextPath: teacherSession ? "/teacher" : "/auth/signin"
  });
}
