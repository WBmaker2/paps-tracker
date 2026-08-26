"use client";

import React, { useEffect, useState } from "react";

import { SplitSessionView } from "./split-session-view";
import type {
  BetterDirection,
  ClassScope,
  EventId,
  SessionType
} from "../../lib/paps/types";
import type { FourFactorProgressView } from "../four-factor-round-types";

type SessionGroupEntry = {
  sessionId: string;
  sessionName: string;
  sessionType: SessionType;
  classScope: ClassScope;
  eventId: EventId;
  eventLabel: string;
  unit: string;
  betterDirection: BetterDirection;
  isOpen: boolean;
  measurementConstraints: {
    min: number;
    max: number;
    precision: number;
  };
  classSections: Array<{
    classId: string;
    label: string;
    students: Array<{
      id: string;
      name: string;
    }>;
  }>;
  factorId?: FourFactorProgressView["factors"][number]["factorId"];
};

export function SessionGroupView({
  sessionGroupId,
  studentAccessToken,
  sessions,
  teacherReturnEnabled = false,
  assessmentProgress = null
}: {
  sessionGroupId?: string | null;
  studentAccessToken?: string | null;
  sessions: SessionGroupEntry[];
  teacherReturnEnabled?: boolean;
  assessmentProgress?: FourFactorProgressView | null;
}) {
  const firstOpenSession = sessions.find((session) => session.isOpen) ?? sessions[0] ?? null;
  const [selectedSessionId, setSelectedSessionId] = useState(firstOpenSession?.sessionId ?? "");
  const [currentAssessmentProgress, setCurrentAssessmentProgress] = useState(assessmentProgress);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [assessmentProgressResetKey, setAssessmentProgressResetKey] = useState(0);
  useEffect(() => setCurrentAssessmentProgress(assessmentProgress), [assessmentProgress]);
  const selectedSession =
    sessions.find((session) => session.sessionId === selectedSessionId) ?? firstOpenSession;
  const handleNextMeasurement = (factorId: NonNullable<SessionGroupEntry["factorId"]>) => {
    const nextSession = sessions.find((session) => session.factorId === factorId && session.isOpen);

    if (nextSession) {
      setSelectedSessionId(nextSession.sessionId);
    }
  };
  const handleStudentChange = (studentId: string) => {
    if (currentStudentId !== null && currentStudentId !== studentId) {
      setCurrentAssessmentProgress(assessmentProgress);
      setAssessmentProgressResetKey((current) => current + 1);
    }

    setCurrentStudentId(studentId);
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">종목을 선택하세요</h2>
          <p className="mt-1 text-sm text-ink/70">
            오늘 측정할 종목을 고른 뒤 이름을 선택하고 기록을 입력합니다.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => {
            const selected = session.sessionId === selectedSession?.sessionId;

            return (
              <button
                key={session.sessionId}
                type="button"
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  selected
                    ? "border-accent/40 bg-accent/10 text-ink"
                    : "border-ink/10 bg-white hover:border-accent/25"
                } disabled:cursor-not-allowed disabled:opacity-50`}
                disabled={!session.isOpen}
                onClick={() => setSelectedSessionId(session.sessionId)}
              >
                <span className="block text-sm font-semibold">{session.eventLabel}</span>
                <span className="mt-1 block text-xs text-ink/60">
                  {session.isOpen ? "입력 가능" : "닫힘"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSession?.isOpen ? (
        <SplitSessionView
          key={selectedSession.sessionId}
          sessionGroupId={sessionGroupId}
          sessionId={selectedSession.sessionId}
          studentAccessToken={studentAccessToken}
          sessionType={selectedSession.sessionType}
          classScope={selectedSession.classScope}
          eventId={selectedSession.eventId}
          eventLabel={selectedSession.eventLabel}
          unit={selectedSession.unit}
          betterDirection={selectedSession.betterDirection}
          measurementConstraints={selectedSession.measurementConstraints}
          classSections={selectedSession.classSections}
          teacherReturnEnabled={teacherReturnEnabled}
          assessmentProgress={currentAssessmentProgress}
          onNextMeasurement={handleNextMeasurement}
          onAssessmentProgressChange={setCurrentAssessmentProgress}
          assessmentProgressResetKey={assessmentProgressResetKey}
          onStudentChange={handleStudentChange}
        />
      ) : (
        <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 text-sm text-ink/70 shadow-sm">
          열려 있는 종목이 없습니다. 선생님이 세션을 열면 기록을 입력할 수 있습니다.
        </section>
      )}
    </div>
  );
}
