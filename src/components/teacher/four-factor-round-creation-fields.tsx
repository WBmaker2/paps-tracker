"use client";

import React from "react";

import {
  FOUR_FACTOR_IDS,
  FOUR_FACTOR_LABELS,
  type FourFactorId
} from "../four-factor-round-types";

type EventOption = { id: string; label: string };

export const createAssessmentRoundIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `assessment-round-${globalThis.crypto.randomUUID()}`;
  }

  return `assessment-round-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export function FourFactorRoundOptions({
  roundType,
  onRoundTypeChange,
  roundNumber,
  onRoundNumberChange,
  eventsByFactor,
  selectedEventsByFactor,
  onEventChange
}: {
  roundType: "regular" | "followUp";
  onRoundTypeChange: (value: "regular" | "followUp") => void;
  roundNumber: number;
  onRoundNumberChange: (value: number) => void;
  eventsByFactor: Record<FourFactorId, EventOption[]>;
  selectedEventsByFactor: Partial<Record<FourFactorId, string>>;
  onEventChange: (factorId: FourFactorId, eventId: string) => void;
}) {
  return (
    <>
      <label className="flex flex-col gap-2 text-sm">
        회차 유형
        <select className="rounded-2xl border border-ink/15 px-4 py-3" value={roundType} onChange={(event) => onRoundTypeChange(event.target.value as "regular" | "followUp")}>
          <option value="regular">정기 평가</option>
          <option value="followUp">추가 평가</option>
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        회차 번호
        <input className="rounded-2xl border border-ink/15 px-4 py-3" type="number" min={1} value={roundNumber} onChange={(event) => onRoundNumberChange(Math.max(1, Number(event.target.value) || 1))} />
      </label>
      <fieldset className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-4 md:col-span-2">
        <legend className="px-1 text-sm font-semibold">4요인별 대표 종목</legend>
        <p className="mt-2 text-sm text-ink/65">각 요인에서 종목을 하나씩 선택하세요. 체지방과 BMI는 이 회차에 포함되지 않습니다.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {FOUR_FACTOR_IDS.map((factorId) => (
            <fieldset key={factorId} className="rounded-xl border border-ink/10 bg-white px-3 py-3">
              <legend className="px-1 text-sm font-semibold">{FOUR_FACTOR_LABELS[factorId]}</legend>
              <div className="mt-2 grid gap-2">
                {eventsByFactor[factorId].map((eventDefinition) => (
                  <label key={eventDefinition.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={`four-factor-${factorId}`}
                      value={eventDefinition.id}
                      checked={selectedEventsByFactor[factorId] === eventDefinition.id}
                      onChange={() => onEventChange(factorId, eventDefinition.id)}
                    />
                    {eventDefinition.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </fieldset>
    </>
  );
}
