"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import { AccessibleDialog } from "../ui/accessible-dialog";
import { LiveStatus } from "../ui/live-status";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30_000;

export function TeacherReturnAccess({
  enabled,
  buttonLabel = "교사용 돌아가기",
  studentAccessToken = null
}: {
  enabled: boolean;
  buttonLabel?: string;
  studentAccessToken?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!lockUntil) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [lockUntil]);

  useEffect(() => {
    if (lockUntil && Date.now() >= lockUntil) {
      setLockUntil(null);
      setFailedAttempts(0);
      setErrorMessage(null);
    }
  }, [lockUntil, now]);

  const remainingLockSeconds = useMemo(() => {
    if (!lockUntil) {
      return 0;
    }

    return Math.max(0, Math.ceil((lockUntil - now) / 1000));
  }, [lockUntil, now]);
  const isLocked = remainingLockSeconds > 0;

  const openModal = () => {
    setIsOpen(true);
    setPin("");
    setErrorMessage(enabled ? null : "교사용 돌아가기 PIN이 아직 설정되지 않았습니다.");
  };

  const closeModal = () => {
    if (isSubmitting) {
      return;
    }

    setIsOpen(false);
    setPin("");
    setErrorMessage(null);
  };

  const handleVerify = async () => {
    if (isLocked) {
      return;
    }

    if (!pin.trim()) {
      setErrorMessage("교사용 PIN을 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/teacher/student-return", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          pin,
          accessToken: studentAccessToken ?? undefined
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            nextPath?: string;
          }
        | null;

      if (!response.ok || !payload?.nextPath) {
        if (response.status === 401) {
          const nextFailedAttempts = failedAttempts + 1;

          if (nextFailedAttempts >= MAX_FAILED_ATTEMPTS) {
            setFailedAttempts(0);
            setLockUntil(Date.now() + LOCK_DURATION_MS);
            setErrorMessage("PIN 입력이 5회 틀려서 30초 동안 잠겼습니다.");
          } else {
            setFailedAttempts(nextFailedAttempts);
            setErrorMessage(
              `${payload?.error ?? "교사용 PIN이 올바르지 않습니다."} (${MAX_FAILED_ATTEMPTS - nextFailedAttempts}회 남음)`
            );
          }
        } else {
          setErrorMessage(payload?.error ?? "교사 확인을 진행하지 못했습니다.");
        }

        return;
      }

      setFailedAttempts(0);
      window.location.assign(payload.nextPath);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "교사 확인을 진행하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="inline-flex rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
        onClick={openModal}
      >
        {buttonLabel}
      </button>

      <AccessibleDialog
        open={isOpen}
        onClose={closeModal}
        titleId="teacher-return-title"
        descriptionId="teacher-return-description"
        initialFocusRef={enabled ? pinInputRef : undefined}
        className="w-full max-w-md rounded-[1.75rem] border border-ink/10 bg-white p-6 shadow-panel"
      >
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
                Teacher Only
              </p>
              <h2 id="teacher-return-title" className="text-2xl font-semibold">
                교사 확인
              </h2>
              <p id="teacher-return-description" className="text-sm leading-6 text-ink/70">
                {enabled
                  ? "학생 화면에서 교사 대시보드로 돌아가려면 교사용 PIN을 입력해 주세요."
                  : "교사 대시보드 이동은 교사용 PIN이 설정된 경우에만 사용할 수 있습니다."}
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {enabled ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-ink">
                  교사용 PIN
                  <input
                    type="password"
                    ref={pinInputRef}
                    inputMode="numeric"
                    autoComplete="off"
                    className="rounded-2xl border border-ink/15 px-4 py-3"
                    value={pin}
                    disabled={isSubmitting || isLocked}
                    onChange={(event) => {
                      setPin(event.target.value);
                      setErrorMessage(null);
                    }}
                  />
                </label>
              ) : null}

              {isLocked ? (
                <LiveStatus className="text-sm text-red-600">
                  다시 시도하려면 {remainingLockSeconds}초 기다려 주세요.
                </LiveStatus>
              ) : null}

              {errorMessage ? (
                <LiveStatus className="text-sm text-red-600">{errorMessage}</LiveStatus>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-ink/10 px-4 py-2 text-sm font-medium text-ink transition hover:border-ink/25"
                disabled={isSubmitting}
                onClick={closeModal}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || isLocked || !enabled}
                onClick={handleVerify}
              >
                {isSubmitting ? "확인 중..." : "교사 확인"}
              </button>
            </div>
      </AccessibleDialog>
    </>
  );
}
