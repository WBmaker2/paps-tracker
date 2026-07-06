import React from "react";

import { GripStrengthBilateralChart } from "../charts/grip-strength-bilateral-chart";
import { ProgressMiniChart } from "../charts/progress-mini-chart";
import {
  isGripStrengthMeasurementDetail,
  formatAttemptDetailSummary,
  summarizeGripStrengthBilateralBest
} from "../../lib/paps/composite-measurements";
import { buildStudentGrowthInsight, formatStudentAttemptChartLabel } from "../../lib/paps/student-growth-insights";
import type {
  BetterDirection,
  EventId,
  OfficialGrade,
  PAPSAttempt,
  PAPSStudentEventHistoryAttempt,
  SessionType
} from "../../lib/paps/types";

const formatImprovement = ({
  attempts,
  latestAttempt,
  betterDirection
}: {
  attempts: PAPSAttempt[];
  latestAttempt: PAPSAttempt | null;
  betterDirection: BetterDirection;
}): number | null => {
  if (attempts.length < 2 || latestAttempt === null) {
    return null;
  }

  const latestAttemptIndex = attempts.findIndex((attempt) => attempt.id === latestAttempt.id);
  const comparisonIndex = latestAttemptIndex >= 0 ? latestAttemptIndex : attempts.length - 1;
  const previousAttempt = comparisonIndex > 0 ? attempts[comparisonIndex - 1] : null;

  if (!previousAttempt) {
    return null;
  }

  if (betterDirection === "higher") {
    return latestAttempt.measurement - previousAttempt.measurement;
  }

  return previousAttempt.measurement - latestAttempt.measurement;
};

const isHistoryAttempt = (attempt: PAPSAttempt): attempt is PAPSStudentEventHistoryAttempt =>
  "sessionName" in attempt;

const compareAttemptsForDisplay = (left: PAPSAttempt, right: PAPSAttempt): number => {
  const leftHistory = isHistoryAttempt(left) ? left : null;
  const rightHistory = isHistoryAttempt(right) ? right : null;

  if (leftHistory && rightHistory && leftHistory.sessionId === rightHistory.sessionId) {
    return (
      left.attemptNumber - right.attemptNumber ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
    );
  }

  return (
    left.createdAt.localeCompare(right.createdAt) ||
    (leftHistory?.sessionId ?? "").localeCompare(rightHistory?.sessionId ?? "") ||
    left.attemptNumber - right.attemptNumber ||
    left.id.localeCompare(right.id)
  );
};

const sortAttemptsForDisplay = (attempts: PAPSAttempt[]): PAPSAttempt[] =>
  [...attempts].sort(compareAttemptsForDisplay);

const formatDelta = (value: number): string =>
  new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 3
  }).format(Number(value.toFixed(3)));

const formatHistorySessionLabel = (attempt: PAPSAttempt): string =>
  isHistoryAttempt(attempt)
    ? `${attempt.sessionName} · ${attempt.sessionType === "official" ? "공식" : "연습"}`
    : `${attempt.attemptNumber}회차`;

export function InstantResultCard({
  studentName,
  sessionType,
  eventId,
  eventLabel,
  unit,
  attempts,
  historyAttempts,
  betterDirection,
  latestOfficialGrade,
  onEditLatestAttempt
}: {
  studentName: string;
  sessionType: SessionType;
  eventId: EventId;
  eventLabel: string;
  unit: string;
  attempts: PAPSAttempt[];
  historyAttempts?: PAPSStudentEventHistoryAttempt[];
  betterDirection: BetterDirection;
  latestOfficialGrade: OfficialGrade | null;
  onEditLatestAttempt?: (attempt: PAPSAttempt) => void;
}) {
  const latestAttempt = attempts.at(-1) ?? null;
  const rawDisplayAttempts =
    historyAttempts && historyAttempts.length > 0
      ? latestAttempt && !historyAttempts.some((attempt) => attempt.id === latestAttempt.id)
        ? [...historyAttempts, latestAttempt]
        : historyAttempts
      : attempts;
  const displayAttempts = sortAttemptsForDisplay(rawDisplayAttempts);
  const showHistory = historyAttempts !== undefined && historyAttempts.length > 0;
  const hasPastSessionHistory =
    showHistory && displayAttempts.some((attempt) => isHistoryAttempt(attempt) && !attempt.isCurrentSession);
  const improvement = formatImprovement({
    attempts: displayAttempts,
    latestAttempt,
    betterDirection
  });
  const latestDetailSummary =
    latestAttempt === null
      ? null
      : formatAttemptDetailSummary({
          eventId,
          detail: latestAttempt.detail
        });
  const attemptRows = displayAttempts.map((attempt) => ({
    attempt,
    detailSummary: formatAttemptDetailSummary({
      eventId,
      detail: attempt.detail
    })
  }));
  const hasDetailSummary = attemptRows.some((entry) => entry.detailSummary !== null);
  const gripRepresentativeSummary =
    eventId === "grip-strength" ? summarizeGripStrengthBilateralBest({ attempts: displayAttempts }) : null;
  const hasGripStrengthDetailHistory = displayAttempts.some((attempt) =>
    isGripStrengthMeasurementDetail(attempt.detail)
  );

  if (!latestAttempt) {
    return null;
  }

  const chartLabelResolver = (attempt: PAPSAttempt, index: number) =>
    formatStudentAttemptChartLabel(attempt, index, latestAttempt.id);
  const growthInsight = buildStudentGrowthInsight({
    attempts: displayAttempts,
    latestAttemptId: latestAttempt.id,
    betterDirection,
    eventLabel,
    unit
  });

  return (
    <section className="rounded-[1.75rem] border border-accent/20 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">즉시 결과</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold">{studentName} 학생 결과</h2>
            <p className="mt-1 text-sm text-ink/70">
              {hasPastSessionHistory
                ? `이번 ${eventLabel} 기록과 지난 세션의 누적 흐름을 함께 확인합니다.`
                : `이번에 입력한 ${eventLabel} 기록을 바로 확인합니다.`}
            </p>
          </div>
          {onEditLatestAttempt ? (
            <button
              type="button"
              className="rounded-full border border-accent/30 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
              onClick={() => onEditLatestAttempt(latestAttempt)}
            >
              방금 기록 수정
            </button>
          ) : null}
        </div>
      </div>
      <div className="mb-4 rounded-2xl border border-ink/10 bg-canvas/70 px-4 py-3 text-sm text-ink/80">
        {growthInsight.summary}
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
          {gripRepresentativeSummary ? (
            <p className="text-sm text-ink/70">
              오른쪽 대표 {gripRepresentativeSummary.right}kg · 왼쪽 대표 {gripRepresentativeSummary.left}kg
            </p>
          ) : null}
          {improvement !== null ? (
            <p className="text-sm text-ink/70">
              직전 대비 {improvement > 0 ? "+" : ""}
              {formatDelta(improvement)} {unit}
            </p>
          ) : (
            <p className="text-sm text-ink/70">첫 입력이라 비교값이 아직 없습니다.</p>
          )}
          {sessionType === "official" && latestOfficialGrade !== null ? (
            <p className="text-sm font-medium text-ink">이번 기록 기준 등급: {latestOfficialGrade}등급</p>
          ) : null}
        </div>
        {eventId === "grip-strength" && hasGripStrengthDetailHistory ? (
          <GripStrengthBilateralChart attempts={displayAttempts} getLabel={chartLabelResolver} />
        ) : (
          <ProgressMiniChart
            attempts={displayAttempts}
            unit={unit}
            title="개인 누적 추이"
            description={hasPastSessionHistory ? "지난 세션까지 이어서 봅니다." : undefined}
            getLabel={chartLabelResolver}
          />
        )}
      </div>
      <div className="mt-4 overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-canvas/60 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">측정</th>
              {showHistory ? <th className="px-4 py-3 font-medium">세션</th> : null}
              <th className="px-4 py-3 font-medium">기록</th>
              {hasDetailSummary ? <th className="px-4 py-3 font-medium">세부 기록</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {attemptRows.map(({ attempt, detailSummary }, index) => (
              <tr key={attempt.id}>
                <td className="px-4 py-3">
                  {attempt.id === latestAttempt.id ? "이번 기록" : `${index + 1}번째 기록`}
                </td>
                {showHistory ? (
                  <td className="px-4 py-3 text-ink/70">{formatHistorySessionLabel(attempt)}</td>
                ) : null}
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
