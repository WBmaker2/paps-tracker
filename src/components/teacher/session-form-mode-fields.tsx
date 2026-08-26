"use client";

import React from "react";

import type { EventId } from "../../lib/paps/types";

type EventOption = { id: EventId; label: string };

export function SessionCreationModeFieldset({
  value,
  disabled,
  onChange
}: {
  value: "event" | "four-factor";
  disabled?: boolean;
  onChange: (value: "event" | "four-factor") => void;
}) {
  return (
    <fieldset className="mb-5 rounded-2xl border border-ink/10 bg-canvas/40 p-4">
      <legend className="px-1 text-sm font-semibold">생성 모드</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {(["event", "four-factor"] as const).map((mode) => (
          <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 ${value === mode ? "border-accent/40 bg-accent/5" : "border-ink/10 bg-white"}`}>
            <input type="radio" name="session-creation-mode" value={mode} aria-label={mode === "four-factor" ? "4요인 평가 회차" : "종목 기록·연습"} checked={value === mode} disabled={disabled || mode === "four-factor" && value === "event" && false} onChange={() => onChange(mode)} />
            <span>
              <span className="block text-sm font-semibold">{mode === "four-factor" ? "4요인 평가 회차" : "종목 기록·연습"}</span>
              <span className="mt-1 block text-xs text-ink/60">{mode === "four-factor" ? "체지방·BMI 없이 네 요인을 한 회차로 관리" : "기존 종목별 세션을 만듭니다."}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
export function EventSessionFields({
  events,
  selectedEventIds,
  disabled,
  onToggle
}: {
  events: EventOption[];
  selectedEventIds: EventId[];
  disabled?: boolean;
  onToggle: (eventId: EventId, checked: boolean) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-ink/10 px-4 py-3 md:col-span-2">
      <legend className="px-1 text-sm font-medium">기록할 종목</legend>
      <p className="mt-2 text-sm text-ink/65">종목을 1개 이상 선택해주세요. 2개 이상 선택하면 하나의 세션 묶음으로 저장됩니다.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {events.map((eventDefinition) => (
          <label key={eventDefinition.id} className="flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={selectedEventIds.includes(eventDefinition.id)} disabled={disabled} onChange={(event) => onToggle(eventDefinition.id, event.target.checked)} />
            {eventDefinition.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
