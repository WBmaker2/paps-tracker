import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";
import type { GradeLevel, PAPSTeacher } from "../../../src/lib/paps/types";

const parseGradeLevel = (value: unknown): GradeLevel => {
  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("A valid grade level is required.");
};

const forbiddenResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
    }
  );

const notFoundResponse = (message: string) =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 404
    }
  );

const getAuthorizedTeacherContext = async (teacherEmail: string): Promise<{
  store: Awaited<ReturnType<typeof createStoreForRequest>>;
  teacher: PAPSTeacher;
}> => {
  const store = await createStoreForRequest();
  const teacher = store.getTeacherByEmail(teacherEmail);

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher
  };
};

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  let store: Awaited<ReturnType<typeof createStoreForRequest>>;
  let teacher: PAPSTeacher;

  try {
    ({ store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email));
  } catch {
    return forbiddenResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenResponse();
  }

  const classes = store
    .listClasses()
    .filter((classroom) => classroom.schoolId === teacher.schoolId);

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
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);
    const schoolId =
      typeof body?.schoolId === "string" && body.schoolId.trim()
        ? body.schoolId.trim()
        : teacher.schoolId;

    if (schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const existingClass = store.listClasses().find((classroom) => classroom.id === requestedId) ?? null;

    if (existingClass && existingClass.schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    const gradeLevel = parseGradeLevel(body?.gradeLevel);
    const classNumber = Number(body?.classNumber);

    if (!Number.isFinite(classNumber) || classNumber < 1) {
      throw new Error("A valid class number is required.");
    }

    const classroom = store.saveClass({
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

    return NextResponse.json(
      {
        classroom
      },
      {
        status: 201
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
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
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);

    if (store.getClass(classId).schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    store.deleteClass(classId);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundResponse(error.message);
    }

    throw error;
  }

  return NextResponse.json({
    ok: true
  });
}
