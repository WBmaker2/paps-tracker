import { NextRequest, NextResponse } from "next/server";

import { getGoogleSheetsEnv } from "../../../../src/lib/env";
import { parseGoogleSheetsUrl } from "../../../../src/lib/google/drive-link";
import { connectTeacherGoogleSheet, PAPS_SPREADSHEET_ID_COOKIE } from "../../../../src/lib/google/sheets-store";
import { createGoogleSheetsClient } from "../../../../src/lib/google/sheets-client";
import { createSchoolStoreForRequest } from "../../../../src/lib/store/paps-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";

const badRequest = (error: string) =>
  NextResponse.json(
    {
      ok: false,
      error
    },
    {
      status: 400
    }
  );

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const parsed = parseGoogleSheetsUrl(typeof body?.url === "string" ? body.url : "");
    const env = getGoogleSheetsEnv();
    const client = createGoogleSheetsClient({
      serviceAccountEmail: env.serviceAccountEmail ?? "service-account@example.com",
      serviceAccountPrivateKey:
        env.serviceAccountPrivateKey ?? "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n"
    });
    const normalizedSchoolName =
      typeof body?.schoolName === "string" && body.schoolName.trim()
        ? body.schoolName.trim()
        : null;
    const connection = await connectTeacherGoogleSheet({
      spreadsheetId: parsed.spreadsheetId,
      normalizedUrl: parsed.normalizedUrl,
      teacherEmail: teacherSession.session.email,
      teacherName: teacherSession.session.name,
      schoolName: normalizedSchoolName,
      client
    });
    let school = connection.school;

    if (process.env.NODE_ENV === "test") {
      const store = await createSchoolStoreForRequest();
      const bootstrap = await store.getTeacherBootstrap({
        teacherEmail: teacherSession.session.email
      });
      const teacher = bootstrap.teacher;
      const existingSchool =
        bootstrap.teacher?.schoolId ? bootstrap.school : bootstrap.schools[0] ?? null;

      school = await store.saveSchool({
        id: existingSchool?.id ?? teacher?.schoolId ?? connection.school.id,
        name: normalizedSchoolName ?? existingSchool?.name ?? connection.school.name,
        teacherIds: Array.from(
          new Set([...(existingSchool?.teacherIds ?? []), ...(teacher ? [teacher.id] : [])])
        ),
        sheetUrl: connection.normalizedUrl,
        createdAt: existingSchool?.createdAt ?? connection.school.createdAt,
        updatedAt: connection.school.updatedAt
      });
    }

    const response = NextResponse.json({
      ok: true,
      spreadsheetId: connection.spreadsheetId,
      normalizedUrl: connection.normalizedUrl,
      school
    });
    response.cookies.set(PAPS_SPREADSHEET_ID_COOKIE, connection.spreadsheetId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/"
    });

    return response;
  } catch (error) {
    return badRequest(
      error instanceof Error ? error.message : "Could not connect the Google Sheet."
    );
  }
}
