"use client";

import React, { useState, useTransition } from "react";

import type { PAPSSyncState } from "../../lib/paps/types";

const STATUS_LABELS: Record<PAPSSyncState, string> = {
  pending: "대기 중",
  synced: "동기화 완료",
  failed: "동기화 실패"
};

export function SyncStatusCard({
  recordId,
  status,
  updatedAt,
  message,
  rebuildSessionId,
  duplicateAttemptCount = 0,
  initialRebuildNeeded = false
}: {
  recordId: string;
  status: PAPSSyncState;
  updatedAt: string;
  message?: string | null;
  rebuildSessionId?: string | null;
  duplicateAttemptCount?: number;
  initialRebuildNeeded?: boolean;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt);
  const [feedback, setFeedback] = useState<string | null>(message ?? null);
  const [rebuildNeeded, setRebuildNeeded] = useState(initialRebuildNeeded);
  const [isPending, startTransition] = useTransition();

  const requeueSync = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/records/${recordId}/representative`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            intent: "requeue-sync"
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          syncStatus?: {
            status: PAPSSyncState;
            updatedAt: string;
          };
        };

        if (!response.ok || !payload.syncStatus) {
          throw new Error(payload.error ?? "재동기화 요청에 실패했습니다.");
        }

        setCurrentStatus(payload.syncStatus.status);
        setCurrentUpdatedAt(payload.syncStatus.updatedAt);
        setFeedback("재동기화를 다시 대기열에 넣었습니다.");
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : "재동기화 요청에 실패했습니다.");
      }
    });
  };

  const rebuildSummaries = () => {
    if (!rebuildSessionId) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/results/rebuild", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            sessionId: rebuildSessionId
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          ok?: boolean;
          rebuildNeeded?: boolean;
          updatedTabs?: string[];
        };

        if (!response.ok || payload.ok !== true) {
          throw Object.assign(new Error(payload.error ?? "요약 재계산에 실패했습니다."), {
            rebuildNeeded: payload.rebuildNeeded === true
          });
        }

        setRebuildNeeded(false);
        setFeedback("학생요약과 공식평가요약을 다시 계산했습니다.");
      } catch (error) {
        if (error && typeof error === "object" && "rebuildNeeded" in error) {
          setRebuildNeeded(Boolean((error as { rebuildNeeded?: boolean }).rebuildNeeded));
        }

        setFeedback(error instanceof Error ? error.message : "요약 재계산에 실패했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Sync</p>
          <h2 className="text-lg font-semibold">{STATUS_LABELS[currentStatus]}</h2>
          <p className="text-sm text-ink/65">마지막 업데이트: {currentUpdatedAt}</p>
          {duplicateAttemptCount > 0 ? (
            <p className="text-sm text-amber-700">중복 제출 {duplicateAttemptCount}건이 있어 요약 재계산이 필요합니다.</p>
          ) : null}
          {rebuildNeeded ? (
            <p className="text-sm font-medium text-amber-700">요약 재계산 필요</p>
          ) : null}
          {feedback ? <p className="text-sm text-ink/75">{feedback}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {rebuildSessionId ? (
            <button
              type="button"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
              onClick={rebuildSummaries}
              disabled={isPending}
            >
              요약 재계산
            </button>
          ) : null}
          {currentStatus === "failed" ? (
            <button
              type="button"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
              onClick={requeueSync}
              disabled={isPending}
            >
              재동기화 요청
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
