import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createGoogleSheetsStoreForRequest, PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import { createSchoolStoreForRequest } from "../../../src/lib/store/paps-store";
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

const createRouteStore = async (request: NextRequest, teacherEmail: string) => {
  if (process.env.NODE_ENV === "test") {
    return createSchoolStoreForRequest();
  }

  const spreadsheetId = request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value;

  if (!spreadsheetId) {
    throw new Error("Google Sheets is not connected.");
  }

  return createGoogleSheetsStoreForRequest({
    spreadsheetId,
    teacherEmail
  });
};

const getAuthorizedTeacherContext = async (
  request: NextRequest,
  teacherEmail: string
): Promise<{
  store: Awaited<ReturnType<typeof createSchoolStoreForRequest>> | Awaited<ReturnType<typeof createGoogleSheetsStoreForRequest>>;
  teacher: PAPSTeacher;
}> => {
  const store = await createRouteStore(request, teacherEmail);
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

  let store: Awaited<ReturnType<typeof getAuthorizedTeacherContext>>["store"];
  let teacher: PAPSTeacher;

  try {
    ({ store, teacher } = await getAuthorizedTeacherContext(request, teacherSession.session.email));
  } catch {
    return forbiddenResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenResponse();
  }

  const schoolId = teacher.schoolId;
  const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.session.email });
  const schools = bootstrap.schools.filter((school) => !schoolId || school.id === schoolId);

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
    const { store, teacher } = await getAuthorizedTeacherContext(request, teacherSession.session.email);
    const bootstrap = await store.getTeacherBootstrap({ teacherEmail: teacherSession.session.email });
    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : teacher.schoolId;
    const existingSchool = bootstrap.schools.find((school) => school.id === requestedId) ?? null;

    if (requestedId !== teacher.schoolId || (existingSchool && existingSchool.id !== teacher.schoolId)) {
      return forbiddenResponse();
    }

    const now = new Date().toISOString();
    const school = await store.saveSchool({
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
    const { store, teacher } = await getAuthorizedTeacherContext(request, teacherSession.session.email);

    if (schoolId !== teacher.schoolId) {
      return forbiddenResponse();
    }

    if ("deleteSchool" in store && typeof store.deleteSchool === "function") {
      await store.deleteSchool(schoolId);
    } else {
      throw new Error("School deletion is not available in the current store.");
    }
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
