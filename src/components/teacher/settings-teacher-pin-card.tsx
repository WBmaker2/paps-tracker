import React from "react";

import { LiveStatus } from "../ui/live-status";

export function SettingsTeacherPinCard({
  configured,
  pin,
  pinConfirmation,
  message,
  pending,
  onPinChange,
  onPinConfirmationChange,
  onSave,
  onClear
}: {
  configured: boolean;
  pin: string;
  pinConfirmation: string;
  message: string | null;
  pending: boolean;
  onPinChange: (value: string) => void;
  onPinConfirmationChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
}) {
  const normalizePin = (value: string) => value.replace(/\D/g, "").slice(0, 6);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">교사 화면 접근 PIN</h2>
          <p className="mt-1 text-sm text-ink/70">
            학생 세션 화면에서 교사 관리 화면으로 돌아갈 때 사용할 PIN을 설정합니다.
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
            configured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {configured ? "PIN 설정됨" : "PIN 미설정"}
        </span>
      </div>
      <details className="mt-4 rounded-2xl border border-ink/10 bg-ink/[0.03] px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-ink">PIN 보관 방식</summary>
        <p className="mt-2 text-sm leading-6 text-ink/70">
          PIN은 구글 시트에 원문이 아닌 해시 형태로 저장됩니다. 학생용 공용 기기에서
          선생님만 교사 관리 화면으로 돌아가게 하는 안전장치입니다.
        </p>
      </details>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          새 PIN
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={pin}
            onChange={(event) => onPinChange(normalizePin(event.target.value))}
            placeholder="4~6자리 숫자"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          새 PIN 확인
          <input
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={pinConfirmation}
            onChange={(event) => onPinConfirmationChange(normalizePin(event.target.value))}
            placeholder="한 번 더 입력"
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSave}
          disabled={pending}
        >
          {configured ? "PIN 변경" : "PIN 저장"}
        </button>
        {configured ? (
          <button
            type="button"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onClear}
            disabled={pending}
          >
            PIN 해제
          </button>
        ) : null}
        {message ? <LiveStatus className="text-sm text-ink/70">{message}</LiveStatus> : null}
      </div>
    </section>
  );
}
