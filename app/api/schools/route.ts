import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { createTeacherSchoolRuntimeStoreForRequest, type TeacherSchoolStore } from "../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../src/lib/teacher-route-context";

export async function GET(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  let store: TeacherSchoolStore;
  let teacher: Awaited<
    ReturnType<typeof getAuthorizedTeacherRouteContext<TeacherSchoolStore>>
  >["teacher"];
  let bootstrap: Awaited<
    ReturnType<typeof getAuthorizedTeacherRouteContext<TeacherSchoolStore>>
  >["bootstrap"];

  try {
    ({ store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherSchoolRuntimeStoreForRequest
    }));
  } catch {
    return forbiddenTeacherRouteResponse();
  }

  const requestedSchoolId = request.nextUrl.searchParams.get("schoolId");

  if (requestedSchoolId && requestedSchoolId !== teacher.schoolId) {
    return forbiddenTeacherRouteResponse();
  }

  const schoolId = teacher.schoolId;
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
    const { store, teacher, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherSchoolRuntimeStoreForRequest
    });
    const requestedId =
      typeof body?.id === "string" && body.id.trim() ? body.id.trim() : teacher.schoolId;
    const existingSchool = bootstrap.schools.find((school) => school.id === requestedId) ?? null;

    if (requestedId !== teacher.schoolId || (existingSchool && existingSchool.id !== teacher.schoolId)) {
      return forbiddenTeacherRouteResponse();
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
      teacherReturnPin: existingSchool?.teacherReturnPin ?? null,
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
      return forbiddenTeacherRouteResponse();
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
    const { store, teacher } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherSchoolRuntimeStoreForRequest
    });

    if (schoolId !== teacher.schoolId) {
      return forbiddenTeacherRouteResponse();
    }

    if ("deleteSchool" in store && typeof store.deleteSchool === "function") {
      await store.deleteSchool(schoolId);
    } else {
      throw new Error("School deletion is not available in the current store.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    throw error;
  }

  return NextResponse.json({
    ok: true
  });
}
