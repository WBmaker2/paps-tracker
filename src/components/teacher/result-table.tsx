"use client";

import React, { useState, useTransition } from "react";

import type { PAPSAttempt } from "../../lib/paps/types";

export interface TeacherResultRow {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  classLabel: string;
  sessionName: string;
  eventLabel: string;
  unit: string;
  representativeAttemptId: string | null;
  attempts: PAPSAttempt[];
  duplicateAttemptCount?: number;
}

export function ResultTable({ rows }: { rows: TeacherResultRow[] }) {
  const [items, setItems] = useState(rows);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectRepresentative = (recordId: string, attemptId: string) => {
    setFeedback(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/records/${recordId}/representative`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            attemptId
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          record?: {
            representativeAttemptId: string | null;
          };
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
        setFeedback("대표값이 업데이트되었습니다.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "대표값을 저장하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">시도 기록</h2>
          <p className="mt-1 text-sm text-ink/70">대표값을 직접 선택하고 결과를 확정합니다.</p>
        </div>
        {feedback ? <p className="text-sm text-ink/70">{feedback}</p> : null}
      </div>
      <div className="space-y-4">
        {items.map((row) => (
          <article key={row.recordId} className="rounded-2xl border border-ink/10 p-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-semibold">
                  {row.studentName} · {row.classLabel}
                </h3>
                <p className="text-sm text-ink/65">
                  {row.sessionName} · {row.eventLabel}
                </p>
                {row.duplicateAttemptCount ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    중복 제출 {row.duplicateAttemptCount}건 감지
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {row.attempts.map((attempt) => {
                const isRepresentative = row.representativeAttemptId === attempt.id;

                return (
                  <div
                    key={attempt.id}
                    className={`rounded-2xl border px-4 py-3 ${
                      isRepresentative
                        ? "border-accent/40 bg-accent/10"
                        : "border-ink/10 bg-canvas/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium">{attempt.attemptNumber}회차</p>
                        <p className="text-sm text-ink/70">
                          {attempt.measurement} {row.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
                        disabled={isPending && !isRepresentative}
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
          </article>
        ))}
      </div>
    </section>
  );
}
