"use client";

import React from "react";

import {
  FOUR_FACTOR_IDS,
  FOUR_FACTOR_LABELS,
  type FourFactorId,
  type FourFactorProgressView,
  type FourFactorStudentResultView,
  type FourFactorValueView
} from "../four-factor-round-types";

const formatScore = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : Number(value.toFixed(1)).toLocaleString("ko-KR");

/** Accept both submit payload variants while the Google/local adapters converge. */
const getResultFactor = (
  factors: FourFactorStudentResultView["factors"] | null | undefined,
  factorId: FourFactorId
): FourFactorValueView | undefined => {
  if (!factors) {
    return undefined;
  }

  return Array.isArray(factors) ? factors.find((factor) => factor.factorId === factorId) : factors[factorId];
};

export function FourFactorProgressCard({
  progress,
  finalizedResult,
  onNextMeasurement
}: {
  progress: FourFactorProgressView;
  finalizedResult?: FourFactorStudentResultView | null;
  onNextMeasurement?: (factorId: FourFactorProgressView["factors"][number]["factorId"]) => void;
}) {
  const completed = progress.roundProgress?.completed ?? progress.factors.filter((factor) => factor.complete).length;
  const displayedResult = finalizedResult ?? progress.finalizedResult ?? null;
  const nextFactor = progress.roundProgress?.nextFactorId ?? progress.factors.find((factor) => !factor.complete)?.factorId;
  const nextEventLabel = progress.roundProgress?.nextEventLabel ?? progress.factors.find((factor) => !factor.complete)?.eventLabel;
  return (
    <section
      className="rounded-[1.75rem] border border-accent/20 bg-white p-5 shadow-sm"
      aria-labelledby="four-factor-progress-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Assessment round</p>
          <h2 id="four-factor-progress-title" className="mt-2 text-xl font-semibold">
            {progress.roundName ?? "체지방 제외 4요인 평가"}
          </h2>
          <p className="mt-1 text-sm text-ink/70">체지방·BMI 없이 네 요인의 측정 진행만 기록합니다.</p>
        </div>
        <div className="rounded-2xl bg-canvas px-4 py-3 text-center" aria-label={`4요인 진행 ${completed}/4`}>
          <p className="text-2xl font-semibold">{completed}/4</p>
          <p className="text-xs text-ink/65">요인 완료</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {progress.factors.map((factor) => (
          <div
            key={factor.factorId}
            className={`rounded-xl border px-3 py-3 ${factor.complete ? "border-emerald-600/25 bg-emerald-50" : "border-ink/10 bg-canvas/45"}`}
          >
            <p className="text-xs font-medium text-ink/65">{FOUR_FACTOR_LABELS[factor.factorId]}</p>
            <p className="mt-1 text-sm font-semibold">{factor.eventLabel}</p>
            <p className="mt-1 text-xs text-ink/65">{factor.complete ? "측정 완료" : "미측정"}</p>
          </div>
        ))}
      </div>

      {displayedResult?.status === "finalized" ? (
        <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/5 p-4">
          <p className="text-sm font-semibold text-accent">선생님이 확정한 최종 결과</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="확정된 4요인 대표 기록">
            {FOUR_FACTOR_IDS.map((factorId) => {
              const factor = getResultFactor(displayedResult?.factors, factorId);
              const measurement = factor?.measurement === null || factor?.measurement === undefined
                ? "—"
                : `${factor.measurement}${factor.unit ? ` ${factor.unit}` : ""}`;

              return (
                <div key={factorId} className="rounded-xl bg-white/75 px-3 py-3">
                  <p className="text-xs font-medium text-ink/60">{FOUR_FACTOR_LABELS[factorId]}</p>
                  <p className="mt-1 text-sm font-semibold">{factor?.eventLabel ?? "—"}</p>
                  <p className="mt-1 text-xs text-ink/70">대표 기록 {measurement} · 요인점수 {formatScore(factor?.factorScore)} / 20</p>
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div><p className="text-xs text-ink/60">체지방 제외 4요인 합계</p><p className="mt-1 text-xl font-semibold">{formatScore(displayedResult.fourFactorSubtotal)} / 80</p></div>
            <div><p className="text-xs text-ink/60">체지방 제외 환산점수</p><p className="mt-1 text-xl font-semibold">{formatScore(displayedResult.normalizedScore)} / 100</p></div>
            <div><p className="text-xs text-ink/60">체지방 제외 4요인 등급</p><p className="mt-1 text-xl font-semibold">{displayedResult.fourFactorGrade ? `${displayedResult.fourFactorGrade}등급` : "—"}</p></div>
          </div>
          <p className="mt-3 text-xs leading-5 text-ink/65">
            공식 PAPS 종합등급이 아닌 체지방 제외 4요인 환산 결과입니다.
          </p>
        </div>
      ) : null}

      {displayedResult?.status !== "finalized" && nextFactor && completed < 4 ? (
        <button
          type="button"
          className="gi-pulse mt-4 w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent sm:w-auto"
          onClick={() => onNextMeasurement?.(nextFactor)}
        >
          다음 미측정 종목{nextEventLabel ? `: ${nextEventLabel}` : ""}
        </button>
      ) : null}

      {!displayedResult && completed === 4 ? (
        <p className="mt-4 rounded-xl bg-canvas/70 px-4 py-3 text-sm text-ink/70" role="status">
          네 요인이 모두 완료되었습니다. 선생님이 결과를 확정하면 최종 결과를 확인할 수 있습니다.
        </p>
      ) : null}
    </section>
  );
}
