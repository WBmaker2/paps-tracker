import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { calculateOfficialGrade } from "../../../../../src/lib/paps/grade";
import { createStoreForRequest } from "../../../../../src/lib/store/paps-store";
import type { OfficialGrade } from "../../../../../src/lib/paps/types";

type SubmitRouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

const parseMeasurement = (value: unknown): number => {
  if (typeof value === "string" && !value.trim()) {
    throw new Error("A numeric measurement is required.");
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

    const studentId =
      typeof body?.studentId === "string" && body.studentId.trim() ? body.studentId.trim() : "";

    if (!studentId) {
      throw new Error("A studentId is required.");
    }

    const student = store.getStudent(studentId);

    if (student.active === false) {
      throw new Error("Inactive students cannot submit attempts.");
    }

    const measurement = parseMeasurement(body?.measurement);
    const createdAt = new Date().toISOString();

    let latestOfficialGrade: OfficialGrade | null = null;

    if (session.sessionType === "official") {
      latestOfficialGrade = calculateOfficialGrade({
        gradeLevel: session.gradeLevel,
        sex: student.sex,
        eventId: session.eventId,
        measurement
      });
    }

    const record = store.appendAttempt({
      id: randomUUID(),
      sessionId,
      studentId,
      measurement,
      createdAt
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
