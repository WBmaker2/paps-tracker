import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { hasOfficialGradeRule } from "../../../../../src/lib/paps/catalog";
import { calculateOfficialGrade } from "../../../../../src/lib/paps/grade";
import {
  appendStudentSubmissionToSheet,
  updateStudentSubmissionInSheet
} from "../../../../../src/lib/google/sheets-submit";
import { resolveSubmissionMeasurement } from "../../../../../src/lib/paps/composite-measurements";
import {
  assertMeasurementAllowed,
  assertMeasurementDetailAllowed
} from "../../../../../src/lib/paps/validation";
import { createStoreForRequest } from "../../../../../src/lib/store/paps-store";
import { resolveStudentSessionAccessToken } from "../../../../../src/lib/student-session-access";
import type { OfficialGrade } from "../../../../../src/lib/paps/types";

type SubmitRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const parseOptionalMeasurement = (value: unknown): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "string" && !value.trim()) {
    return undefined;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw new Error("A numeric measurement is required.");
  }

  return numericValue;
};

const parseRequiredText = (value: unknown, message: string): string => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  throw new Error(message);
};

const getProductionAccessPayload = (body: unknown, sessionId: string) => {
  const accessToken =
    typeof (body as { accessToken?: unknown } | null)?.accessToken === "string" &&
    (body as { accessToken?: string }).accessToken?.trim()
      ? (body as { accessToken: string }).accessToken.trim()
      : null;

  if (!accessToken) {
    throw new Error("Student session access token is required.");
  }

  const accessPayload = resolveStudentSessionAccessToken(accessToken);

  if (accessPayload.sessionId && accessPayload.sessionId !== sessionId) {
    throw new Error("Student session access token does not match this session.");
  }

  if (!accessPayload.sessionId && !accessPayload.sessionGroupId) {
    throw new Error("Student session access token does not match this session.");
  }

  return accessPayload;
};

const toSheetSubmitStatus = (error: string, fallbackStatus?: number): number =>
  fallbackStatus ??
  (error.includes("was not found")
    ? 404
    : error === "Session is closed." ||
        error === "Only the latest attempt can be edited." ||
        error.startsWith("Append") ||
        error.startsWith("Update")
      ? 409
      : 400);

const toLocalSubmitStatus = (message: string): number => {
  if (message.includes("was not found")) {
    return 404;
  }

  if (message === "Session is closed." || message === "Only the latest attempt can be edited.") {
    return 409;
  }

  return 400;
};

export async function POST(request: NextRequest, context: SubmitRouteContext) {
  const body = await request.json().catch(() => null);
  const { sessionId } = await context.params;

  try {
    const studentId =
      typeof body?.studentId === "string" && body.studentId.trim() ? body.studentId.trim() : "";

    if (!studentId) {
      throw new Error("A studentId is required.");
    }

    if (process.env.NODE_ENV === "production") {
      const accessPayload = getProductionAccessPayload(body, sessionId);
      const clientSubmissionKey =
        typeof body?.clientSubmissionKey === "string" && body.clientSubmissionKey.trim()
          ? body.clientSubmissionKey.trim()
          : randomUUID();
      const sheetResult = await appendStudentSubmissionToSheet({
        spreadsheetId: accessPayload.spreadsheetId,
        sessionId,
        studentId,
        measurement: parseOptionalMeasurement(body?.measurement),
        detail: body?.detail ?? null,
        clientSubmissionKey,
        authorizedSessionGroupId: accessPayload.sessionGroupId ?? null
      });

      if (!sheetResult.ok) {
        return NextResponse.json(
          {
            error: sheetResult.error
          },
          {
            status: toSheetSubmitStatus(sheetResult.error, sheetResult.status)
          }
        );
      }

      return NextResponse.json(
        {
          result: sheetResult.result
        },
        {
          status: 201
        }
      );
    }

    const store = await createStoreForRequest();
    const session = store.getSession(sessionId);

    if (session.isOpen === false) {
      return NextResponse.json(
        {
          error: "Session is closed."
        },
        {
          status: 409
        }
      );
    }

    const student = store.getStudent(studentId);

    if (student.active === false) {
      throw new Error("Inactive students cannot submit attempts.");
    }

    const resolvedSubmission = resolveSubmissionMeasurement({
      eventId: session.eventId,
      measurement: parseOptionalMeasurement(body?.measurement),
      detail: body?.detail ?? null
    });

    assertMeasurementDetailAllowed({
      eventId: session.eventId,
      detail: resolvedSubmission.detail
    });
    assertMeasurementAllowed({
      eventId: session.eventId,
      measurement: resolvedSubmission.measurement
    });
    const createdAt = new Date().toISOString();

    let latestOfficialGrade: OfficialGrade | null = null;

    if (
      session.sessionType === "official" &&
      hasOfficialGradeRule(session.eventId, student.gradeLevel, student.sex)
    ) {
      latestOfficialGrade = calculateOfficialGrade({
        gradeLevel: student.gradeLevel,
        sex: student.sex,
        eventId: session.eventId,
        measurement: resolvedSubmission.measurement
      });
    }

    const record = store.appendAttempt({
      id: randomUUID(),
      sessionId,
      studentId,
      measurement: resolvedSubmission.measurement,
      createdAt,
      clientSubmissionKey:
        typeof body?.clientSubmissionKey === "string" && body.clientSubmissionKey.trim()
          ? body.clientSubmissionKey.trim()
          : undefined,
      detail: resolvedSubmission.detail
    });

    return NextResponse.json(
      {
        result: {
          student: {
            id: student.id,
            name: student.name
          },
          attempts: record.attempts,
          historyAttempts: store.listStudentEventHistory({
            sessionId,
            studentId
          }),
          latestOfficialGrade
        }
      },
      {
        status: 201
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit the attempt.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: toLocalSubmitStatus(message)
      }
    );
  }
}

export async function PATCH(request: NextRequest, context: SubmitRouteContext) {
  const body = await request.json().catch(() => null);
  const { sessionId } = await context.params;

  try {
    const studentId = parseRequiredText(body?.studentId, "A studentId is required.");
    const attemptId = parseRequiredText(body?.attemptId, "An attemptId is required.");
    const clientSubmissionKey =
      typeof body?.clientSubmissionKey === "string" && body.clientSubmissionKey.trim()
        ? body.clientSubmissionKey.trim()
        : null;

    if (process.env.NODE_ENV === "production") {
      const accessPayload = getProductionAccessPayload(body, sessionId);

      if (!clientSubmissionKey) {
        throw new Error("A clientSubmissionKey is required.");
      }

      const sheetResult = await updateStudentSubmissionInSheet({
        spreadsheetId: accessPayload.spreadsheetId,
        sessionId,
        studentId,
        attemptId,
        measurement: parseOptionalMeasurement(body?.measurement),
        detail: body?.detail ?? null,
        clientSubmissionKey,
        authorizedSessionGroupId: accessPayload.sessionGroupId ?? null
      });

      if (!sheetResult.ok) {
        return NextResponse.json(
          {
            error: sheetResult.error
          },
          {
            status: toSheetSubmitStatus(sheetResult.error, sheetResult.status)
          }
        );
      }

      return NextResponse.json({
        result: sheetResult.result
      });
    }

    const store = await createStoreForRequest();
    const session = store.getSession(sessionId);

    if (session.isOpen === false) {
      return NextResponse.json(
        {
          error: "Session is closed."
        },
        {
          status: 409
        }
      );
    }

    const student = store.getStudent(studentId);

    if (student.active === false) {
      throw new Error("Inactive students cannot submit attempts.");
    }

    const resolvedSubmission = resolveSubmissionMeasurement({
      eventId: session.eventId,
      measurement: parseOptionalMeasurement(body?.measurement),
      detail: body?.detail ?? null
    });

    assertMeasurementDetailAllowed({
      eventId: session.eventId,
      detail: resolvedSubmission.detail
    });
    assertMeasurementAllowed({
      eventId: session.eventId,
      measurement: resolvedSubmission.measurement
    });

    let latestOfficialGrade: OfficialGrade | null = null;

    if (
      session.sessionType === "official" &&
      hasOfficialGradeRule(session.eventId, student.gradeLevel, student.sex)
    ) {
      latestOfficialGrade = calculateOfficialGrade({
        gradeLevel: student.gradeLevel,
        sex: student.sex,
        eventId: session.eventId,
        measurement: resolvedSubmission.measurement
      });
    }

    const record = store.updateAttempt({
      attemptId,
      sessionId,
      studentId,
      measurement: resolvedSubmission.measurement,
      clientSubmissionKey,
      detail: resolvedSubmission.detail
    });

    return NextResponse.json({
      result: {
        student: {
          id: student.id,
          name: student.name
        },
        attempts: record.attempts,
        historyAttempts: store.listStudentEventHistory({
          sessionId,
          studentId
        }),
        latestOfficialGrade
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update the attempt.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: toLocalSubmitStatus(message)
      }
    );
  }
}
