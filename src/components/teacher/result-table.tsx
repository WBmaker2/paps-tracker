"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { TeacherResultRowView } from "../../lib/teacher-results";
import { formatTeacherUnit } from "../../lib/teacher-results";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

const formatLocalDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
};

export type TeacherResultRow = TeacherResultRowView;

export function ResultTable({
  rows,
  activeRecordId,
  onRecordFocus,
  onRepresentativeChange
}: {
  rows: TeacherResultRow[];
  activeRecordId?: string | null;
  onRecordFocus?: (recordId: string) => void;
  onRepresentativeChange?: (recordId: string, representativeAttemptId: string | null) => void;
}) {
  const [items, setItems] = useState(rows);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(rows);
  }, [rows]);

  const selectRepresentative = (recordId: string, attemptId: string) => {
    setFeedback(null);
    onRecordFocus?.(recordId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/records/${recordId}/representative`, {
          method: "PATCH",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            attemptId
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          record?: {
            representativeAttemptId: string | null;
          };
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.record) {
          throw new Error(payload.error ?? "대표값을 저장하지 못했습니다.");
        }

        setItems((currentItems) =>
          currentItems.map((row) =>
            row.recordId === recordId
              ? {
                  ...row,
                  representativeAttemptId: payload.record?.representativeAttemptId ?? null
                }
              : row
          )
        );
        onRepresentativeChange?.(recordId, payload.record?.representativeAttemptId ?? null);
        setFeedback("대표값이 업데이트되었습니다.");
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "대표값을 저장하지 못했습니다.");
      }
    });
  };

  return (
    <section className="min-w-0 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">시도 기록</h2>
          <p className="mt-1 text-sm text-ink/70">
            학생별 시도 기록을 보고 대표 기록을 확정합니다.
          </p>
        </div>
        {feedback ? <p role="status" aria-live="polite" className="text-sm text-ink/70">{feedback}</p> : null}
      </div>
      <div className="space-y-4">
        {items.map((row) => {
          const firstAttemptBySubmission = new Map<string, string>();
          const duplicateAttemptIds = new Set<string>();
          [...row.attempts]
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
            .forEach((attempt) => {
              const key = attempt.clientSubmissionKey?.trim();
              if (!key) return;
              if (firstAttemptBySubmission.has(key)) duplicateAttemptIds.add(attempt.id);
              else firstAttemptBySubmission.set(key, attempt.id);
            });
          const preferredAttemptId = row.representativeAttemptId && !duplicateAttemptIds.has(row.representativeAttemptId)
            ? row.representativeAttemptId
            : row.attempts.find((attempt) => !duplicateAttemptIds.has(attempt.id))?.id;

          return <article
            key={row.recordId}
            className={`rounded-2xl border p-4 ${
              activeRecordId && activeRecordId === row.recordId
                ? "border-accent/40 bg-accent/5"
                : "border-ink/10"
            }`}
          >
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="break-words font-semibold">
                  {row.studentName} · {row.classLabel}
                </h3>
                <p className="text-sm text-ink/65">
                  {row.sessionName} · {row.eventLabel}
                </p>
                {row.duplicateAttemptCount ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    원본 시도 중 중복 제출 {row.duplicateAttemptCount}건을 확인했습니다. 원본은 보존됩니다.
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {row.attempts.map((attempt) => {
                const isRepresentative = row.representativeAttemptId === attempt.id;
                const isDuplicate = duplicateAttemptIds.has(attempt.id);
                const isNextAction = row.recordId === activeRecordId && attempt.id === preferredAttemptId;

                return (
                  <div
                    key={attempt.id}
                    className={`min-w-0 rounded-2xl border px-4 py-3 ${
                      isRepresentative
                        ? "border-accent/40 bg-accent/10"
                        : "border-ink/10 bg-canvas/30"
                    }`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="font-medium">{attempt.attemptNumber}회차</p>
                        <p className="text-sm text-ink/70">
                          {attempt.measurement} {formatTeacherUnit(row.unit)}
                        </p>
                        <p className="mt-1 text-xs text-ink/60">측정 시각 {formatLocalDateTime(attempt.createdAt)}</p>
                        {isDuplicate ? (
                          <p className="mt-1 text-xs font-medium text-amber-800">같은 제출의 중복 원본 · 대표값 선택 불가</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className={`min-h-11 w-full rounded-full border border-ink/15 px-4 py-2 text-sm font-medium sm:w-auto ${isNextAction && !isRepresentative ? "gi-pulse" : ""}`}
                        disabled={isPending || isDuplicate}
                        onClick={() => selectRepresentative(row.recordId, attempt.id)}
                      >
                        {isRepresentative
                          ? `${attempt.attemptNumber}회차 대표값`
                          : `${attempt.attemptNumber}회차 대표값으로 선택`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}
