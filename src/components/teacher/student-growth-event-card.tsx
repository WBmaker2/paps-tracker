"use client";

import React from "react";

import { TeacherProgressChart } from "../charts/teacher-progress-chart";
import type {
  TeacherStudentGrowthAttemptView,
  TeacherStudentGrowthEventView
} from "../../lib/teacher-results";

const sessionTypeLabel = (sessionType: TeacherStudentGrowthAttemptView["sessionType"]) =>
  sessionType === "official" ? "공식" : "연습";

const formatMeasurement = (attempt: TeacherStudentGrowthAttemptView, unit: string) =>
  `${attempt.measurement} ${unit}`;

export function StudentGrowthEventCard({ event }: { event: TeacherStudentGrowthEventView }) {
  return (
    <article className="rounded-[1.5rem] border border-ink/10 bg-canvas/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{event.eventLabel}</h3>
          <p className="mt-1 text-sm text-ink/65">
            세션을 넘어 누적된 {event.attempts.length}개 기록을 시간순으로 확인합니다.
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/65">
          단위 {event.unit}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <TeacherProgressChart
          title={`${event.eventLabel} 누적 추이`}
          attempts={event.attempts}
          unit={event.unit}
          description="지난 세션 기록까지 포함해 학생의 변화 흐름을 보여줍니다."
          getLabel={(_, index) => `${index + 1}번째`}
        />

        <div className="overflow-hidden rounded-[1.25rem] border border-ink/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-canvas/70 text-ink/80">
              <tr>
                <th className="px-4 py-3 font-semibold">측정 세션</th>
                <th className="px-4 py-3 font-semibold">기록</th>
                <th className="px-4 py-3 font-semibold">대표</th>
              </tr>
            </thead>
            <tbody>
              {event.attempts.map((attempt) => (
                <tr key={`${attempt.sessionId}:${attempt.id}`} className="border-t border-ink/10">
                  <td className="px-4 py-3 text-ink/75">
                    {attempt.sessionName} · {sessionTypeLabel(attempt.sessionType)}
                  </td>
                  <td className="px-4 py-3 font-semibold">
                    {formatMeasurement(attempt, event.unit)}
                  </td>
                  <td className="px-4 py-3">
                    {attempt.isRepresentative ? (
                      <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                        대표 기록
                      </span>
                    ) : (
                      <span className="text-xs text-ink/45">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  );
}
