import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createTeacherRuntimeStoreForRequest, type TeacherCrudStore } from "../../../src/lib/google/sheets-store";
import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../../src/lib/teacher-live-update-protocol";
import { publishTeacherLiveUpdate } from "../../../src/lib/teacher-live-updates";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext,
  notFoundTeacherRouteResponse
} from "../../../src/lib/teacher-route-context";
import { buildTeacherStateVersion } from "../../../src/lib/google/sheet-state-version";
import type { GradeLevel, StudentSex } from "../../../src/lib/paps/types";

const parseGradeLevel = (value: unknown): GradeLevel => {
  const numericValue = Number(value);

  if (numericValue === 3 || numericValue === 4 || numericValue === 5 || numericValue === 6) {
    return numericValue;
  }

  throw new Error("학년 정보를 확인해주세요.");
};

const parseStudentSex = (value: unknown): StudentSex => {
  if (value === "male" || value === "female") {
    return value;
  }

  throw new Error("성별을 선택해주세요.");
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
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentNumber = Number(body?.studentNumber);
  const fieldErrors: Record<string, string> = {};

  if (!name) fieldErrors.name = "학생 이름을 입력해주세요.";
  if (!Number.isSafeInteger(studentNumber) || studentNumber < 1) {
    fieldErrors.studentNumber = "번호는 1 이상의 정수로 입력해주세요.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "입력 내용을 확인해주세요.", fieldErrors }, { status: 400 });
  }

  try {
    const originClientId = request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER);
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
      studentNumber,
      name,
      sex: parseStudentSex(body?.sex),
      gradeLevel: parseGradeLevel(body?.gradeLevel),
      active: body?.active !== false
    });
    const nextStudents = existingStudent
      ? bootstrap.students.map((entry) => (entry.id === student.id ? student : entry))
      : [...bootstrap.students, student];
    const teacherStateVersion = buildTeacherStateVersion({
      ...bootstrap,
      students: nextStudents
    });

    const response = NextResponse.json(
      {
        student,
        teacherStateVersion
      },
      {
        status: 201
      }
    );

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "student",
      originClientId
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
        error: error instanceof Error ? error.message : "학생을 저장하지 못했습니다."
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
    return NextResponse.json({ error: "학생을 선택해주세요." }, { status: 400 });
  }

  try {
    const originClientId = request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER);
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherRuntimeStoreForRequest
    });
    const student = await store.getStudent(studentId);

    if (student.schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    const hasRecordedResults = bootstrap.attempts.some((attempt) => attempt.studentId === studentId) ||
      (bootstrap.studentRoundResults ?? []).some((result) => result.studentId === studentId);
    if (hasRecordedResults) {
      return NextResponse.json({
        error: "측정 기록이 있는 학생은 보관할 수 없습니다. 측정 기록과 학생 정보를 안전하게 유지했습니다."
      }, { status: 409 });
    }

    // Archive only the roster row. Measurement and audit source rows are never rewritten.
    await store.saveStudent({ ...student, active: false });
    const teacherStateVersion = buildTeacherStateVersion({
      ...bootstrap,
      students: bootstrap.students.filter((entry) => entry.id !== studentId)
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "student",
      originClientId
    });

    return NextResponse.json({
      ok: true,
      archived: true,
      teacherStateVersion
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
