"use client";

import React, { useEffect, useState } from "react";

export function RecordForm({
  studentId,
  studentName,
  eventLabel,
  unit,
  isSubmitting,
  errorMessage,
  onSubmit
}: {
  studentId: string;
  studentName: string;
  eventLabel: string;
  unit: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onSubmit: (measurement: number) => Promise<void> | void;
}) {
  const [measurement, setMeasurement] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setMeasurement("");
    setLocalError(null);
  }, [studentId]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!measurement.trim()) {
      setLocalError("숫자 기록을 입력해 주세요.");
      return;
    }

    const numericMeasurement = Number(measurement);

    if (!Number.isFinite(numericMeasurement)) {
      setLocalError("숫자 기록을 입력해 주세요.");
      return;
    }

    setLocalError(null);
    await onSubmit(numericMeasurement);
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{studentName}</h2>
        <p className="mt-1 text-sm text-ink/70">
          {eventLabel} 기록을 입력하고 바로 제출합니다.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm">
          {eventLabel} 기록
          <input
            type="number"
            inputMode="decimal"
            step="any"
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={measurement}
            onChange={(inputEvent) => setMeasurement(inputEvent.target.value)}
          />
        </label>
        <p className="text-sm text-ink/70">단위: {unit}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            기록 제출
          </button>
          {localError ? <p className="text-sm font-medium text-rose-700">{localError}</p> : null}
          {!localError && errorMessage ? (
            <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
