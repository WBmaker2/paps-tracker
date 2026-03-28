import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { calculateOfficialGrade } from "../../../../../src/lib/paps/grade";
import { appendStudentSubmissionToSheet } from "../../../../../src/lib/google/sheets-submit";
import { resolveSubmissionMeasurement } from "../../../../../src/lib/paps/composite-measurements";
import {
  assertMeasurementAllowed,
  assertMeasurementDetailAllowed
} from "../../../../../src/lib/paps/validation";
import { PAPS_SPREADSHEET_ID_COOKIE } from "../../../../../src/lib/google/sheets-store";
import { createStoreForRequest } from "../../../../../src/lib/store/paps-store";
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

export async function POST(request: NextRequest, context: SubmitRouteContext) {
  const body = await request.json().catch(() => null);
  const { sessionId } = await context.params;

  try {
    const studentId =
      typeof body?.studentId === "string" && body.studentId.trim() ? body.studentId.trim() : "";

    if (!studentId) {
      throw new Error("A studentId is required.");
    }

    const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null;

    if (process.env.NODE_ENV === "production") {
      if (!spreadsheetId) {
        throw new Error("Google Sheets is not connected.");
      }

      const clientSubmissionKey =
        typeof body?.clientSubmissionKey === "string" && body.clientSubmissionKey.trim()
          ? body.clientSubmissionKey.trim()
          : randomUUID();
      const sheetResult = await appendStudentSubmissionToSheet({
        spreadsheetId,
        sessionId,
        studentId,
        measurement: parseOptionalMeasurement(body?.measurement),
        detail: body?.detail ?? null,
        clientSubmissionKey
      });

      if (!sheetResult.ok) {
        const status =
          sheetResult.status ??
          (sheetResult.error.includes("was not found")
            ? 404
            : sheetResult.error === "Session is closed." || sheetResult.error.startsWith("Append")
              ? 409
              : 400);

        return NextResponse.json(
          {
            error: sheetResult.error
          },
          {
            status
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

    if (session.sessionType === "official") {
      latestOfficialGrade = calculateOfficialGrade({
        gradeLevel: session.gradeLevel,
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
        status: message.includes("was not found") ? 404 : 400
      }
    );
  }
}
