import React from "react";

import { ProgressMiniChart } from "../charts/progress-mini-chart";
import { formatAttemptDetailSummary } from "../../lib/paps/composite-measurements";
import type {
  BetterDirection,
  EventId,
  OfficialGrade,
  PAPSAttempt,
  SessionType
} from "../../lib/paps/types";

const formatImprovement = ({
  attempts,
  betterDirection
}: {
  attempts: PAPSAttempt[];
  betterDirection: BetterDirection;
}): number | null => {
  if (attempts.length < 2) {
    return null;
  }

  const latestAttempt = attempts.at(-1);
  const previousAttempt = attempts.at(-2);

  if (!latestAttempt || !previousAttempt) {
    return null;
  }

  if (betterDirection === "higher") {
    return latestAttempt.measurement - previousAttempt.measurement;
  }

  return previousAttempt.measurement - latestAttempt.measurement;
};

export function InstantResultCard({
  studentName,
  sessionType,
  eventId,
  eventLabel,
  unit,
  attempts,
  betterDirection,
  latestOfficialGrade
}: {
  studentName: string;
  sessionType: SessionType;
  eventId: EventId;
  eventLabel: string;
  unit: string;
  attempts: PAPSAttempt[];
  betterDirection: BetterDirection;
  latestOfficialGrade: OfficialGrade | null;
}) {
  const latestAttempt = attempts.at(-1) ?? null;
  const improvement = formatImprovement({
    attempts,
    betterDirection
  });
  const latestDetailSummary =
    latestAttempt === null
      ? null
      : formatAttemptDetailSummary({
          eventId,
          detail: latestAttempt.detail
        });
  const attemptRows = attempts.map((attempt) => ({
    attempt,
    detailSummary: formatAttemptDetailSummary({
      eventId,
      detail: attempt.detail
    })
  }));
  const hasDetailSummary = attemptRows.some((entry) => entry.detailSummary !== null);

  if (!latestAttempt) {
    return null;
  }

  return (
    <section className="rounded-[1.75rem] border border-accent/20 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">즉시 결과</p>
        <h2 className="mt-2 text-2xl font-semibold">{studentName} 학생 결과</h2>
        <p className="mt-1 text-sm text-ink/70">
          이번에 입력한 {eventLabel} 기록을 바로 확인합니다.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-3 rounded-2xl bg-canvas/80 p-4">
          <p className="text-sm text-ink/70">이번 기록</p>
          <p className="text-3xl font-semibold">
            {latestAttempt.measurement} {unit}
          </p>
          {latestDetailSummary ? (
            <p className="text-sm text-ink/70">{latestDetailSummary}</p>
          ) : null}
          {improvement !== null ? (
            <p className="text-sm text-ink/70">
              직전 대비 {improvement > 0 ? "+" : ""}
              {improvement} {unit}
            </p>
          ) : (
            <p className="text-sm text-ink/70">첫 입력이라 비교값이 아직 없습니다.</p>
          )}
          {sessionType === "official" && latestOfficialGrade !== null ? (
            <p className="text-sm font-medium text-ink">이번 기록 기준 등급: {latestOfficialGrade}등급</p>
          ) : null}
        </div>
        <ProgressMiniChart attempts={attempts} unit={unit} />
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-canvas/60 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">회차</th>
              <th className="px-4 py-3 font-medium">기록</th>
              {hasDetailSummary ? <th className="px-4 py-3 font-medium">세부 기록</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {attemptRows.map(({ attempt, detailSummary }) => (
              <tr key={attempt.id}>
                <td className="px-4 py-3">{attempt.attemptNumber}회차</td>
                <td className="px-4 py-3">
                  {attempt.measurement} {unit}
                </td>
                {hasDetailSummary ? (
                  <td className="px-4 py-3 text-ink/70">
                    {detailSummary ? `세부: ${detailSummary}` : "-"}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
