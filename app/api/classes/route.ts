import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../src/lib/google/sheets-store";
import { publishTeacherLiveUpdate } from "../../../src/lib/teacher-live-updates";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext,
  notFoundTeacherRouteResponse
} from "../../../src/lib/teacher-route-context";
import type { GradeLevel } from "../../../src/lib/paps/types";

const parseGradeLevel = (value: unknown): GradeLevel => {
  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("A valid grade level is required.");
};

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  let teacher: Awaited<
    ReturnType<typeof getAuthorizedTeacherRouteContext<TeacherCrudStore>>
  >["teacher"];
  let bootstrap: Awaited<
    ReturnType<typeof getAuthorizedTeacherRouteContext<TeacherCrudStore>>
  >["bootstrap"];

  try {
    ({ teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    }));
  } catch {
    return forbiddenTeacherRouteResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenTeacherRouteResponse();
  }

  const classes = bootstrap.classes.filter((classroom) => classroom.schoolId === teacher.schoolId);

  return NextResponse.json({
    classes
  });
}

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const schoolId =
      typeof body?.schoolId === "string" && body.schoolId.trim()
        ? body.schoolId.trim()
        : teacher.schoolId;

    if (schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const existingClass = bootstrap.classes.find((classroom) => classroom.id === requestedId) ?? null;

    if (existingClass && existingClass.schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    const gradeLevel = parseGradeLevel(body?.gradeLevel);
    const classNumber = Number(body?.classNumber);

    if (!Number.isFinite(classNumber) || classNumber < 1) {
      throw new Error("A valid class number is required.");
    }

    const classroom = await store.saveClass({
      id: requestedId,
      schoolId,
      academicYear: Number(body?.academicYear) || new Date().getUTCFullYear(),
      gradeLevel,
      classNumber,
      label:
        typeof body?.label === "string" && body.label.trim()
          ? body.label.trim()
          : `${gradeLevel}-${classNumber}`,
      active: body?.active !== false
    });

    const response = NextResponse.json(
      {
        classroom
      },
      {
        status: 201
      }
    );

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "class"
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save the class."
      },
      {
        status: 400
      }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const classId = request.nextUrl.searchParams.get("classId");

  if (!classId) {
    return NextResponse.json({ error: "classId is required." }, { status: 400 });
  }

  try {
    const { store, teacher } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });

    if ((await store.getClass(classId)).schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    await store.deleteClass(classId);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundTeacherRouteResponse(error.message);
    }

    throw error;
  }

  publishTeacherLiveUpdate({
    teacherEmail: teacherSession.session.email,
    source: "class"
  });

  return NextResponse.json({
    ok: true
  });
}
