"use client";

import React from "react";

import { TeacherProgressChart } from "../charts/teacher-progress-chart";
import type {
  TeacherStudentGrowthAttemptView,
  TeacherStudentGrowthEventView
} from "../../lib/teacher-results";
import { formatTeacherUnit } from "../../lib/teacher-results";

const sessionTypeLabel = (sessionType: TeacherStudentGrowthAttemptView["sessionType"]) =>
  sessionType === "official" ? "공식" : "연습";

const formatMeasurement = (attempt: TeacherStudentGrowthAttemptView, unit: string) =>
  `${attempt.measurement} ${formatTeacherUnit(unit)}`;
const formatLocalDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
};

export function StudentGrowthEventCard({ event }: { event: TeacherStudentGrowthEventView }) {
  const chartAttempts = event.attempts.filter((attempt) => !attempt.isDuplicate);
  const duplicateCount = event.attempts.length - chartAttempts.length;
  return (
    <article className="rounded-[1.5rem] border border-ink/10 bg-canvas/40 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-lg font-semibold">{event.eventLabel}</h3>
          <p className="mt-1 text-sm text-ink/65">
            중복을 제외한 {chartAttempts.length}개 측정값을 그래프로 비교합니다.
            {duplicateCount > 0 ? ` 원본 기록 ${duplicateCount}건은 중복 표시로 보존됩니다.` : ""}
          </p>
        </div>
        <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-ink/65">
          측정 단위: {formatTeacherUnit(event.unit)}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <TeacherProgressChart
          title={`${event.eventLabel} 누적 추이`}
          attempts={chartAttempts}
          unit={formatTeacherUnit(event.unit)}
          description="지난 세션 기록까지 포함해 학생의 변화 흐름을 보여줍니다."
          getLabel={(_, index) => `${index + 1}번째`}
        />

        <div className="min-w-0 overflow-x-auto rounded-[1.25rem] border border-ink/10 bg-white">
          <table className="min-w-[520px] w-full text-left text-sm">
            <thead className="bg-canvas/70 text-ink/80">
              <tr>
                <th className="px-4 py-3 font-semibold">측정 세션</th>
                <th className="px-4 py-3 font-semibold">측정 시각</th>
                <th className="px-4 py-3 font-semibold">기록</th>
                <th className="px-4 py-3 font-semibold">대표</th>
                <th className="px-4 py-3 font-semibold">상태</th>
              </tr>
            </thead>
            <tbody>
              {event.attempts.map((attempt) => (
                <tr key={`${attempt.sessionId}:${attempt.id}`} className="border-t border-ink/10">
                  <td className="px-4 py-3 text-ink/75">
                    {attempt.sessionName} · {sessionTypeLabel(attempt.sessionType)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink/75">{formatLocalDateTime(attempt.createdAt)}</td>
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
                  <td className="px-4 py-3">
                    {attempt.isDuplicate ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">중복 원본</span>
                    ) : <span className="text-xs text-ink/60">반영</span>}
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
