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
import type { GradeLevel, StudentSex } from "../../../src/lib/paps/types";

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

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  try {
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const classId = request.nextUrl.searchParams.get("classId");

    if (classId) {
      const classroom = await store.getClass(classId);

      if (classroom.schoolId !== teacher.schoolId) {
        return forbiddenTeacherRouteResponse();
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
      return forbiddenTeacherRouteResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundTeacherRouteResponse(error.message);
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
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const classId =
      typeof body?.classId === "string" && body.classId.trim() ? body.classId.trim() : "";
    const classroom = classId ? await store.getClass(classId) : null;

    if (!classId || !classroom || classroom.schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : randomUUID();
    const existingStudent = bootstrap.students.find((student) => student.id === requestedId) ?? null;

    if (existingStudent && existingStudent.schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    const student = await store.saveStudent({
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

    const response = NextResponse.json(
      {
        student
      },
      {
        status: 201
      }
    );

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "student"
    });

    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    if (error instanceof Error && error.message.includes("was not found")) {
      return notFoundTeacherRouteResponse(error.message);
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
    const { store, teacher } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });

    if ((await store.getStudent(studentId)).schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    await store.deleteStudent(studentId);
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
    source: "student"
  });

  return NextResponse.json({
    ok: true
  });
}
