"use client";

import React, { useMemo, useState, useTransition } from "react";

import {
  FOUR_FACTOR_IDS,
  FOUR_FACTOR_LABELS,
  FOUR_FACTOR_STATUS_DESCRIPTIONS,
  FOUR_FACTOR_STATUS_LABELS,
  type FourFactorId,
  type FourFactorResultStatus,
  type FourFactorStudentResultView,
  type FourFactorValueView
} from "../four-factor-round-types";
import { adaptRoundResult } from "./four-factor-round-adapter";
import type { PAPSStudentRoundResult } from "../../lib/paps/types";
import { buildTeacherMutationHeaders } from "./teacher-data-refresh";

const createIdempotencyKey = (suffix: string): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `four-factor-${globalThis.crypto.randomUUID()}-${suffix}`;
  }

  return `four-factor-${Date.now()}-${Math.random().toString(36).slice(2)}-${suffix}`;
};

const formatScore = (value: number | null | undefined): string =>
  value === null || value === undefined ? "—" : Number(value.toFixed(1)).toLocaleString("ko-KR");

const getResultFactor = (
  factors: FourFactorStudentResultView["factors"],
  factorId: FourFactorId
): FourFactorValueView | undefined =>
  Array.isArray(factors) ? factors.find((factor) => factor.factorId === factorId) : factors[factorId];

const statusClass: Record<FourFactorResultStatus, string> = {
  incomplete: "border-ink/10 bg-canvas/60 text-ink/65",
  excluded: "border-ink/10 bg-ink/5 text-ink/60",
  ready: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  finalized: "border-accent/30 bg-accent/10 text-accent",
  stale: "border-amber-500/40 bg-amber-50 text-amber-900"
};

type FinalizeResponse = {
  result?: FourFactorStudentResultView | PAPSStudentRoundResult;
  results?: Array<FourFactorStudentResultView | PAPSStudentRoundResult>;
  replayed?: boolean;
  error?: { code?: string; message?: string } | string;
};

type RoundResultInput = FourFactorStudentResultView | PAPSStudentRoundResult;

const toViewResult = (result: RoundResultInput): FourFactorStudentResultView =>
  "studentSnapshot" in result ? adaptRoundResult(result) : result;

export type FourFactorRoundResultPanelProps = {
  roundId: string;
  roundName?: string;
  roundRevision?: number;
  results?: FourFactorStudentResultView[];
  loading?: boolean;
  emptyMessage?: string;
  onResultsChange?: (results: FourFactorStudentResultView[]) => void;
  endpointBase?: string;
};

const getErrorMessage = (payload: FinalizeResponse, fallback: string): string => {
  if (typeof payload.error === "string") {
    return payload.error;
  }

  return payload.error?.message ?? fallback;
};

export function FourFactorRoundResultPanel({
  roundId,
  roundName,
  roundRevision = 0,
  results = [],
  loading = false,
  emptyMessage = "아직 측정한 학생 결과가 없습니다.",
  onResultsChange,
  endpointBase = `/api/assessment-rounds/${roundId}`
}: FourFactorRoundResultPanelProps) {
  const [items, setItems] = useState(results);
  const [pendingStudentId, setPendingStudentId] = useState<string | null>(null);
  const [isBulkPending, startBulkTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  React.useEffect(() => setItems(results), [results]);

  const readyResults = useMemo(
    () => items.filter((result) => result.status === "ready"),
    [items]
  );

  const updateItems = (nextResults: FourFactorStudentResultView[]) => {
    setItems(nextResults);
    onResultsChange?.(nextResults);
  };

  const finalizeStudent = async (result: FourFactorStudentResultView) => {
    setPendingStudentId(result.studentId);
    setErrorMessage(null);
    setMessage(null);

    try {
      const response = await fetch(
        `${endpointBase}/students/${encodeURIComponent(result.studentId)}/finalize`,
        {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json",
            "Idempotency-Key": createIdempotencyKey(result.studentId),
            "If-Match-Revision": String(result.revision ?? 0)
          }),
          body: JSON.stringify({
            expectedResultRevision: result.revision ?? 0
          })
        }
      );
      const payload = (await response.json()) as FinalizeResponse;

      if (!response.ok || !payload.result) {
        throw new Error(getErrorMessage(payload, "결과를 확정하지 못했습니다."));
      }

      const nextResult = toViewResult(payload.result);
      updateItems(items.map((entry) => (entry.studentId === result.studentId ? nextResult : entry)));
      setMessage(
        payload.replayed
          ? `${result.studentName} 학생의 확정 결과를 다시 확인했습니다.`
          : `${result.studentName} 학생의 4요인 결과를 확정했습니다.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "결과를 확정하지 못했습니다.");
    } finally {
      setPendingStudentId(null);
    }
  };

  const finalizeReady = () => {
    if (readyResults.length === 0) {
      return;
    }

    setErrorMessage(null);
    setMessage(null);
    startBulkTransition(async () => {
      try {
        const response = await fetch(`${endpointBase}/finalize-ready`, {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json",
            "Idempotency-Key": createIdempotencyKey("ready"),
            "If-Match-Revision": String(roundRevision)
          }),
          body: JSON.stringify({
            studentIds: readyResults.map((result) => result.studentId),
            expectedRoundRevision: roundRevision,
            expectedResultRevisions: Object.fromEntries(
              readyResults.map((result) => [result.studentId, result.revision ?? 0])
            )
          })
        });
        const payload = (await response.json()) as FinalizeResponse;

        if (!response.ok || !payload.results) {
          throw new Error(getErrorMessage(payload, "준비된 학생 결과를 확정하지 못했습니다."));
        }

        const resultsByStudentId = new Map(
          payload.results.map((result) => {
            const viewResult = toViewResult(result);
            return [viewResult.studentId, viewResult] as const;
          })
        );
        updateItems(items.map((entry) => resultsByStudentId.get(entry.studentId) ?? entry));
        setMessage(`${payload.results.length}명의 4요인 결과를 확정했습니다.`);
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "준비된 학생 결과를 확정하지 못했습니다."
        );
      }
    });
  };

  return (
    <section
      className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm"
      aria-labelledby="four-factor-result-title"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Assessment round</p>
          <h2 id="four-factor-result-title" className="mt-2 text-xl font-semibold">
            {roundName ? `${roundName} · ` : ""}체지방 제외 4요인 결과
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/70">
            심폐지구력·유연성·근력·근지구력·순발력만 반영합니다. 공식 PAPS 종합점수·종합등급이 아닙니다.
          </p>
        </div>
        <button
          type="button"
          className="gi-pulse w-full rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          onClick={finalizeReady}
          disabled={isBulkPending || readyResults.length === 0}
          aria-busy={isBulkPending}
        >
          {isBulkPending ? "결과를 다시 확인하고 있습니다" : `준비 학생 일괄 확정 (${readyResults.length})`}
        </button>
      </div>

      <div className="mt-4 min-h-6" aria-live="polite" role="status">
        {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
        {errorMessage ? <p className="text-sm font-medium text-rose-700">{errorMessage}</p> : null}
      </div>

      {loading ? (
        <div className="mt-3 grid gap-3" aria-label="결과 불러오는 중">
          {[1, 2].map((index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-canvas" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-ink/15 px-4 py-8 text-sm text-ink/60">
          {emptyMessage}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {items.map((result) => {
            const pending = pendingStudentId === result.studentId;
            const canFinalize = result.status === "ready" || result.status === "stale";

            return (
              <article key={result.studentId} className="rounded-2xl border border-ink/10 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{result.studentName}</h3>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[result.status]}`}>
                        {FOUR_FACTOR_STATUS_LABELS[result.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-ink/65">{FOUR_FACTOR_STATUS_DESCRIPTIONS[result.status]}</p>
                  </div>
                  {canFinalize ? (
                    <button
                      type="button"
                      className="gi-pulse w-full rounded-full border border-accent/35 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent hover:text-white disabled:cursor-wait disabled:opacity-50 sm:w-auto"
                      onClick={() => void finalizeStudent(result)}
                      disabled={pending || isBulkPending}
                      aria-busy={pending}
                    >
                      {pending
                        ? "결과를 다시 확인하고 있습니다"
                        : result.status === "stale"
                          ? "변경 결과 재확정"
                          : "4요인 결과 확정"}
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {FOUR_FACTOR_IDS.map((factorId) => {
                    const factor = getResultFactor(result.factors, factorId);

                    return (
                      <div key={factorId} className="rounded-xl bg-canvas/70 px-3 py-2">
                        <p className="text-xs font-medium text-ink/60">{FOUR_FACTOR_LABELS[factorId]}</p>
                        <p className="mt-1 text-sm font-semibold">
                          {factor?.eventLabel ?? "미측정"}
                          {factor?.measurement !== null && factor?.measurement !== undefined
                            ? ` · ${factor.measurement}${factor.unit ? ` ${factor.unit}` : ""}`
                            : ""}
                        </p>
                        <p className="mt-1 text-xs text-ink/65">요인점수 {formatScore(factor?.factorScore ?? null)} / 20</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-ink/10 pt-3 text-sm">
                  <span>체지방 제외 4요인 합계 <strong>{formatScore(result.fourFactorSubtotal)} / 80</strong></span>
                  <span>체지방 제외 환산점수 <strong>{formatScore(result.normalizedScore)} / 100</strong></span>
                  <span>체지방 제외 4요인 등급 <strong>{result.fourFactorGrade ? `${result.fourFactorGrade}등급` : "—"}</strong></span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
