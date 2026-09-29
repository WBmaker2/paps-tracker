"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { PAPSSyncState } from "../../lib/paps/types";
import type { TeacherResultSyncView } from "../../lib/teacher-results";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

const STATUS_LABELS: Record<PAPSSyncState, string> = {
  pending: "대기 중",
  synced: "시트 반영됨",
  failed: "시트 반영 실패"
};

const formatLocalDateTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
};

export function SyncStatusCard({
  recordId,
  status,
  updatedAt,
  message,
  rebuildSessionId,
  duplicateAttemptCount = 0,
  initialRebuildNeeded = false,
  onSyncStatusChange,
  onSummariesRebuilt
}: {
  recordId: string;
  status: PAPSSyncState;
  updatedAt: string;
  message?: string | null;
  rebuildSessionId?: string | null;
  duplicateAttemptCount?: number;
  initialRebuildNeeded?: boolean;
  onSyncStatusChange?: (sync: TeacherResultSyncView) => void;
  onSummariesRebuilt?: () => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt);
  const [feedback, setFeedback] = useState<string | null>(message ?? null);
  const [rebuildNeeded, setRebuildNeeded] = useState(initialRebuildNeeded);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setCurrentStatus(status);
    setCurrentUpdatedAt(updatedAt);
  }, [recordId, status, updatedAt]);

  useEffect(() => {
    setFeedback(message ?? null);
  }, [message, recordId]);

  useEffect(() => {
    setRebuildNeeded(initialRebuildNeeded);
  }, [initialRebuildNeeded, recordId]);

  const requeueSync = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/records/${recordId}/representative`, {
          method: "PATCH",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
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
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.syncStatus) {
          throw new Error(payload.error ?? "재동기화 요청에 실패했습니다.");
        }

        setCurrentStatus(payload.syncStatus.status);
        setCurrentUpdatedAt(payload.syncStatus.updatedAt);
        setFeedback("재동기화를 다시 대기열에 넣었습니다.");
        onSyncStatusChange?.({
          status: payload.syncStatus.status,
          updatedAt: payload.syncStatus.updatedAt,
          message: null
        });
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
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
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
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
        setFeedback("학생요약과 공식평가요약을 다시 정리했습니다.");
        onSummariesRebuilt?.();
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
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-semibold text-accent">원본 시트 반영 상태</p>
          <h2 className="text-lg font-semibold">{STATUS_LABELS[currentStatus]}</h2>
          <p className="text-sm text-ink/65">마지막 확인: {formatLocalDateTime(currentUpdatedAt)}</p>
          {duplicateAttemptCount > 0 ? (
            <p className="text-sm text-amber-700">
              원본 중복 제출 {duplicateAttemptCount}건을 보존하고 있습니다.
            </p>
          ) : null}
          {rebuildNeeded ? (
            <p className="text-sm font-medium text-amber-700">요약표 갱신 필요 · 원본 저장 상태와 별도입니다.</p>
          ) : null}
          {feedback ? <p role="status" aria-live="polite" className="text-sm text-ink/75">{feedback}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {rebuildSessionId ? (
            <button
              type="button"
              className={`min-h-11 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium ${rebuildNeeded ? "gi-pulse" : ""}`}
              onClick={rebuildSummaries}
              disabled={isPending}
            >
              요약 재계산
            </button>
          ) : null}
          {currentStatus === "failed" ? (
            <button
              type="button"
              className="min-h-11 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
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
