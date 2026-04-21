import React from "react";

import { StudentSessionNavigation } from "../../../src/components/student/student-session-navigation";
import { SessionGroupView } from "../../../src/components/student/session-group-view";
import { hasStudentTeacherPin } from "../../../src/lib/env";
import { loadStudentSessionGroupViewFromSheet } from "../../../src/lib/google/sheets-submit";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";
import { resolveStudentSessionAccessToken } from "../../../src/lib/student-session-access";

type StudentSessionGroupPageProps = {
  params: Promise<{
    sessionGroupId: string;
  }>;
  searchParams: Promise<{
    access?: string;
  }>;
};

export default async function StudentSessionGroupPage({
  params,
  searchParams
}: StudentSessionGroupPageProps) {
  const { sessionGroupId } = await params;
  const { access } = await searchParams;
  const teacherReturnEnabled = hasStudentTeacherPin();

  try {
    const accessPayload =
      process.env.NODE_ENV === "production"
        ? typeof access === "string" && access.trim()
          ? resolveStudentSessionAccessToken(access.trim())
          : (() => {
              throw new Error("Student session access token is required.");
            })()
        : null;

    if (
      process.env.NODE_ENV === "production" &&
      accessPayload?.sessionGroupId !== sessionGroupId
    ) {
      throw new Error("Student session access token does not match this session.");
    }

    const groupView =
      process.env.NODE_ENV === "production"
        ? await loadStudentSessionGroupViewFromSheet({
            spreadsheetId: accessPayload!.spreadsheetId,
            sessionGroupId
          })
        : await (await createStoreForRequest()).getStudentSessionGroupView(sessionGroupId);
    const sessions = groupView.sessions.map(({ session, classSections }) => {
      const eventDefinition = getEventDefinition(session.eventId);

      return {
        sessionId: session.id,
        sessionName: session.name ?? eventDefinition.label,
        sessionType: session.sessionType,
        classScope: session.classScope,
        eventId: session.eventId,
        eventLabel: eventDefinition.label,
        unit: eventDefinition.unit,
        betterDirection: eventDefinition.betterDirection,
        isOpen: session.isOpen !== false,
        measurementConstraints: eventDefinition.measurementConstraints,
        classSections
      };
    });

    return (
      <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                  Student Session
                </p>
                <h1 className="mt-3 text-3xl font-semibold">{groupView.groupName}</h1>
                <p className="mt-2 text-base leading-7 text-ink/75">
                  종목을 선택한 뒤 이름을 누르고 기록을 입력합니다. 제출 직후에만 본인
                  결과를 확인할 수 있습니다.
                </p>
              </div>
              <StudentSessionNavigation
                teacherReturnEnabled={teacherReturnEnabled}
                className="shrink-0 justify-end"
              />
            </div>
          </section>
          <SessionGroupView
            studentAccessToken={typeof access === "string" ? access : null}
            sessions={sessions}
            teacherReturnEnabled={teacherReturnEnabled}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                Student Session
              </p>
              <h1 className="text-3xl font-semibold">세션 묶음을 찾을 수 없습니다.</h1>
              <p className="text-base leading-7 text-ink/75">
                {error instanceof Error
                  ? error.message
                  : "요청한 세션 묶음 정보를 불러오지 못했습니다."}
              </p>
            </div>
            <StudentSessionNavigation
              teacherReturnEnabled={teacherReturnEnabled}
              className="shrink-0 justify-end"
            />
          </div>
        </div>
      </main>
    );
  }
}
