import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";

import { SplitSessionView } from "../../../src/components/student/split-session-view";
import { loadStudentSessionViewFromSheet } from "../../../src/lib/google/sheets-submit";
import { PAPS_SPREADSHEET_ID_COOKIE } from "../../../src/lib/google/sheets-store";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

type StudentSessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

export default async function StudentSessionPage({ params }: StudentSessionPageProps) {
  const { sessionId } = await params;

  try {
    const { session, classSections } =
      process.env.NODE_ENV === "production"
        ? await loadStudentSessionViewFromSheet({
            spreadsheetId:
              (await cookies()).get(PAPS_SPREADSHEET_ID_COOKIE)?.value ??
              (() => {
                throw new Error("Google Sheets is not connected.");
              })(),
            sessionId
          })
        : await (await createStoreForRequest()).getStudentSessionView(sessionId);
    const eventDefinition = getEventDefinition(session.eventId);

    if (session.isOpen === false) {
      return (
        <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
              Student Session
            </p>
            <h1 className="text-3xl font-semibold">{session.name ?? "학생 입력 세션"}</h1>
            <p className="text-base leading-7 text-ink/75">이 세션은 지금 닫혀 있습니다.</p>
            <div>
              <Link
                href="/"
                className="inline-flex rounded-full border border-ink/10 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
              >
                홈으로 돌아가기
              </Link>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <section className="rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
              Student Session
            </p>
            <h1 className="mt-3 text-3xl font-semibold">{session.name ?? "학생 입력 세션"}</h1>
            <p className="mt-2 text-base leading-7 text-ink/75">
              이름만 선택한 뒤 <strong>{eventDefinition.label}</strong> 기록을
              입력합니다. 제출 직후에만 본인 결과를 확인할 수 있습니다.
            </p>
          </section>
          <SplitSessionView
            sessionId={session.id}
            sessionType={session.sessionType}
            classScope={session.classScope}
            eventId={session.eventId}
            eventLabel={eventDefinition.label}
            unit={eventDefinition.unit}
            betterDirection={eventDefinition.betterDirection}
            measurementConstraints={eventDefinition.measurementConstraints}
            classSections={classSections}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
            Student Session
          </p>
          <h1 className="text-3xl font-semibold">세션을 찾을 수 없습니다.</h1>
          <p className="text-base leading-7 text-ink/75">
            {error instanceof Error ? error.message : "요청한 세션 정보를 불러오지 못했습니다."}
          </p>
          <div>
            <Link
              href="/"
              className="inline-flex rounded-full border border-ink/10 px-4 py-2 text-sm font-medium transition hover:border-accent/40 hover:text-accent"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }
}
