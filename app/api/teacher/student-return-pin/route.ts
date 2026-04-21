import { NextRequest, NextResponse } from "next/server";

import { buildTeacherStateVersion } from "../../../../src/lib/google/sheet-state-version";
import {
  createTeacherSchoolRuntimeStoreForRequest
} from "../../../../src/lib/google/sheets-store";
import { requireTeacherRouteSession } from "../../../../src/lib/teacher-auth";
import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext
} from "../../../../src/lib/teacher-route-context";
import { TEACHER_LIVE_UPDATE_CLIENT_HEADER } from "../../../../src/lib/teacher-live-update-protocol";
import { publishTeacherLiveUpdate } from "../../../../src/lib/teacher-live-updates";
import type { PAPSSchool } from "../../../../src/lib/paps/types";
import type { TeacherBootstrap } from "../../../../src/lib/store/paps-store-types";
import {
  createTeacherReturnPinConfig,
  validateTeacherReturnPin
} from "../../../../src/lib/teacher-return";

const noSchoolResponse = () =>
  NextResponse.json({ error: "학교 정보를 먼저 저장해주세요." }, { status: 400 });

const createNextTeacherStateVersion = ({
  bootstrap,
  school
}: {
  bootstrap: TeacherBootstrap;
  school: PAPSSchool;
}): string =>
  buildTeacherStateVersion({
    ...bootstrap,
    school,
    schools: bootstrap.schools.some((entry) => entry.id === school.id)
      ? bootstrap.schools.map((entry) => (entry.id === school.id ? school : entry))
      : [...bootstrap.schools, school]
  });

export async function POST(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  const body = (await request.json().catch(() => null)) as
    | {
        pin?: unknown;
      }
    | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const validationError = validateTeacherReturnPin(pin);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const { store, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherSchoolRuntimeStoreForRequest
    });
    const school = bootstrap.school;

    if (!school) {
      return noSchoolResponse();
    }

    const nextSchool = await store.saveSchool({
      ...school,
      teacherReturnPin: createTeacherReturnPinConfig({
        pin,
        updatedByTeacherEmail: teacherSession.session.email
      })
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "school",
      originClientId: request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER)
    });

    return NextResponse.json({
      teacherReturnPinConfigured: true,
      updatedAt: nextSchool.teacherReturnPin?.updatedAt ?? null,
      teacherStateVersion: createNextTeacherStateVersion({
        bootstrap,
        school: nextSchool
      })
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "교사용 PIN을 저장하지 못했습니다."
      },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const teacherSession = await requireTeacherRouteSession();

  if (!teacherSession.ok) {
    return teacherSession.response;
  }

  try {
    const { store, bootstrap } = await getAuthorizedTeacherRouteContext({
      request,
      teacherEmail: teacherSession.session.email,
      createStore: createTeacherSchoolRuntimeStoreForRequest
    });
    const school = bootstrap.school;

    if (!school) {
      return noSchoolResponse();
    }

    const nextSchool = await store.saveSchool({
      ...school,
      teacherReturnPin: null
    });

    publishTeacherLiveUpdate({
      teacherEmail: teacherSession.session.email,
      source: "school",
      originClientId: request.headers.get(TEACHER_LIVE_UPDATE_CLIENT_HEADER)
    });

    return NextResponse.json({
      teacherReturnPinConfigured: false,
      updatedAt: null,
      teacherStateVersion: createNextTeacherStateVersion({
        bootstrap,
        school: nextSchool
      })
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Forbidden") {
      return forbiddenTeacherRouteResponse();
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "교사용 PIN을 해제하지 못했습니다."
      },
      { status: 400 }
    );
  }
}
