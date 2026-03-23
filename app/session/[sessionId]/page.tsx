import React from "react";
import Link from "next/link";

import { SplitSessionView } from "../../../src/components/student/split-session-view";
import { getEventDefinition } from "../../../src/lib/paps/catalog";
import type { EventId, PAPSStudent } from "../../../src/lib/paps/types";
import { createStoreForRequest } from "../../../src/lib/store/paps-store";

type StudentSessionPageProps = {
  params: Promise<{
    sessionId: string;
  }>;
};

const STUDENT_EVENT_LABELS: Record<EventId, string> = {
  "sit-and-reach": "앉아윗몸앞으로굽히기",
  "shuttle-run": "왕복오래달리기",
  "long-run-walk": "오래달리기-걷기"
};

const sortStudents = (left: PAPSStudent, right: PAPSStudent): number => {
  if (left.studentNumber !== undefined && right.studentNumber !== undefined) {
    return left.studentNumber - right.studentNumber;
  }

  return left.name.localeCompare(right.name, "en");
};

export default async function StudentSessionPage({ params }: StudentSessionPageProps) {
  const { sessionId } = await params;
  const store = await createStoreForRequest();

  try {
    const session = store.getSession(sessionId);
    const eventDefinition = getEventDefinition(session.eventId);
    const students = store.listStudents().filter((student) => student.active !== false);
    const classSections = session.classTargets.map((classTarget) => {
      const classroom = store.getClass(classTarget.classId);

      return {
        classId: classroom.id,
        label: classroom.label,
        students: students
          .filter((student) => student.classId === classroom.id)
          .sort(sortStudents)
          .map((student) => ({
            id: student.id,
            name: student.name
          }))
      };
    });

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
              이름만 선택한 뒤 <strong>{STUDENT_EVENT_LABELS[session.eventId]}</strong> 기록을
              입력합니다. 제출 직후에만 본인 결과를 확인할 수 있습니다.
            </p>
          </section>
          <SplitSessionView
            sessionId={session.id}
            sessionType={session.sessionType}
            classScope={session.classScope}
            eventLabel={STUDENT_EVENT_LABELS[session.eventId]}
            unit={eventDefinition.unit}
            betterDirection={eventDefinition.betterDirection}
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
