"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import {
  createSavedSchoolSettings,
  persistSavedSchoolSettings,
  readSavedSchoolSettings
} from "./saved-school-settings";

type AutoRestoreState = "idle" | "restoring" | "failed";

type GoogleSheetConnectionPayload = {
  ok?: boolean;
  error?: string;
  code?: string;
  school?: Parameters<typeof createSavedSchoolSettings>[0];
  normalizedUrl?: string;
};

const shouldAttemptAutoRestore = (sheetStatus: TeacherSheetStatus): boolean =>
  sheetStatus.code === "not_connected" && !sheetStatus.isConnected && sheetStatus.canReconnect;

export function TeacherSheetAutoLoader({ sheetStatus }: { sheetStatus: TeacherSheetStatus }) {
  const { refresh } = useRouter();
  const attemptedKeyRef = useRef<string | null>(null);
  const [restoreState, setRestoreState] = useState<AutoRestoreState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!shouldAttemptAutoRestore(sheetStatus)) {
      return;
    }

    const savedSettings = readSavedSchoolSettings();

    if (!savedSettings?.sheetUrl.trim()) {
      return;
    }

    const attemptKey = `${savedSettings.schoolName}:${savedSettings.sheetUrl}`;

    if (attemptedKeyRef.current === attemptKey) {
      return;
    }

    attemptedKeyRef.current = attemptKey;
    let cancelled = false;

    setRestoreState("restoring");
    setMessage("이전에 저장한 구글 시트 연결을 불러오는 중입니다.");

    const reconnect = async () => {
      try {
        const response = await fetch("/api/google-sheet/connect", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            url: savedSettings.sheetUrl,
            schoolName: savedSettings.schoolName
          })
        });
        const payload = (await response.json()) as GoogleSheetConnectionPayload;

        if (!response.ok || !payload.school) {
          throw new Error(
            payload.code === "teacher_not_authorized"
              ? "이전 구글 시트에 현재 교사가 등록되어 있지 않습니다. 설정 화면에서 기존 시트 가져오기를 눌러 주세요."
              : payload.error ?? "이전 구글 시트 연결을 불러오지 못했습니다."
          );
        }

        const nextSavedSettings = createSavedSchoolSettings(payload.school, {
          sheetUrl: payload.normalizedUrl ?? payload.school.sheetUrl ?? savedSettings.sheetUrl
        });

        persistSavedSchoolSettings(nextSavedSettings);

        if (!cancelled) {
          setMessage("이전 구글 시트 연결을 불러왔습니다.");
          refresh();
        }
      } catch (error) {
        if (!cancelled) {
          setRestoreState("failed");
          setMessage(
            error instanceof Error ? error.message : "이전 구글 시트 연결을 불러오지 못했습니다."
          );
        }
      }
    };

    void reconnect();

    return () => {
      cancelled = true;
    };
  }, [refresh, sheetStatus]);

  if (restoreState === "idle" || !message) {
    return null;
  }

  return (
    <section
      className={`rounded-[1.75rem] border p-4 text-sm shadow-sm ${
        restoreState === "failed"
          ? "border-amber-200 bg-amber-50 text-ink"
          : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
      role="status"
      aria-live="polite"
    >
      {message}
    </section>
  );
}
