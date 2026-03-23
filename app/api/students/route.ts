import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";
import type { GradeLevel, PAPSTeacher, StudentSex } from "../../../src/lib/paps/types";

const parseGradeLevel = (value: unknown): GradeLevel => {
  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("A valid grade level is required.");
};

const parseStudentSex = (value: unknown): StudentSex => {
  if (value === "male" || value === "female") {
    return value;
  }

  throw new Error("A valid student sex is required.");
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
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail });
  const teacher = bootstrap.teacher;

  if (!teacher?.schoolId) {
    throw new Error("Forbidden");
  }

  return {
    store,
    teacher: teacher as PAPSTeacher
  };
};

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  try {
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);
    const classId = request.nextUrl.searchParams.get("classId");
    const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.session.email });

    if (classId) {
      const classroom = store.getClass(classId);

      if (classroom.schoolId !== teacher.schoolId) {
        return forbiddenResponse();
      }
    }

    const students = bootstrap.students
      .filter((student) => student.schoolId === teacher.schoolId)
      .filter((student) => !classId || student.classId === classId);

    return NextResponse.json({
      students
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundResponse(error.message);
    }

    throw error;
  }
}

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);
    const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.session.email });
    const classId =
      typeof body?.classId === "string" && body.classId.trim() ? body.classId.trim() : "";
    const classroom = classId ? store.getClass(classId) : null;

    if (!classId || !classroom || classroom.schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const existingStudent = bootstrap.students.find((student) => student.id === requestedId) ?? null;

    if (existingStudent && existingStudent.schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    const student = store.saveStudent({
      id: requestedId,
      schoolId: classroom.schoolId,
      classId,
      studentNumber: Number(body?.studentNumber) || undefined,
      name:
        typeof body?.name === "string" && body.name.trim()
          ? body.name.trim()
          : "이름 없는 학생",
      sex: parseStudentSex(body?.sex),
      gradeLevel: parseGradeLevel(body?.gradeLevel),
      active: body?.active !== false
    });

    return NextResponse.json(
      {
        student
      },
      {
        status: 201
      }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundResponse(error.message);
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not save the student."
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

  const studentId = request.nextUrl.searchParams.get("studentId");

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required." }, { status: 400 });
  }

  try {
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);

    if (store.getStudent(studentId).schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    store.deleteStudent(studentId);
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
