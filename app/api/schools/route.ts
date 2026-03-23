import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";
import type { PAPSTeacher } from "../../../src/lib/paps/types";

const forbiddenResponse = (message = "Forbidden") =>
  NextResponse.json(
    {
      error: message
    },
    {
      status: 403
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

  const schoolId = teacher.schoolId;
  const schools = store.listSchools().filter((school) => !schoolId || school.id === schoolId);

  return NextResponse.json({
    schools
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
    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : teacher.schoolId;
    const existingSchool = store.listSchools().find((school) => school.id === requestedId) ?? null;

    if (requestedId !== teacher.schoolId || (existingSchool && existingSchool.id !== teacher.schoolId)) {
      return forbiddenResponse();
    }

    const now = new Date().toISOString();
    const school = store.saveSchool({
      id: requestedId ?? randomUUID(),
      name:
        typeof body?.name === "string" && body.name.trim()
          ? body.name.trim()
          : "이름 없는 학교",
      teacherIds: Array.from(
        new Set([
          teacher.id,
          ...(Array.isArray(body?.teacherIds)
            ? body.teacherIds.filter((value: unknown): value is string => typeof value === "string")
            : [])
        ])
      ),
      sheetUrl:
        typeof body?.sheetUrl === "string" && body.sheetUrl.trim() ? body.sheetUrl.trim() : null,
      createdAt:
        typeof body?.createdAt === "string"
          ? body.createdAt
          : existingSchool?.createdAt ?? now,
      updatedAt: now
    });

    return NextResponse.json(
      {
        school
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
        error: error instanceof Error ? error.message : "Could not save the school."
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

  const schoolId = request.nextUrl.searchParams.get("schoolId");

  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required." }, { status: 400 });
  }

  try {
    const { store, teacher } = await getAuthorizedTeacherContext(teacherSession.session.email);

    if (schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    store.deleteSchool(schoolId);
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenResponse();
    }

    throw error;
  }

  return NextResponse.json({
    ok: true
  });
}
