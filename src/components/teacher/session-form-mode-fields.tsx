"use client";

import React from "react";

import type { EventId } from "../../lib/paps/types";

type EventOption = { id: EventId; label: string };

export function EventSessionFields({
  events,
  selectedEventIds,
  disabled,
  lockedEventIds = [],
  onToggle
}: {
  events: EventOption[];
  selectedEventIds: EventId[];
  disabled?: boolean;
  lockedEventIds?: EventId[];
  onToggle: (eventId: EventId, checked: boolean) => void;
}) {
  return (
    <fieldset className="rounded-2xl border border-ink/10 px-4 py-3 md:col-span-2">
      <legend className="px-1 text-sm font-medium">기록할 종목</legend>
      <p className="mt-2 text-sm text-ink/65">종목을 1개 이상 선택해주세요. 2개 이상 선택하면 하나의 세션 묶음으로 저장됩니다.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {events.map((eventDefinition) => (
          <label key={eventDefinition.id} className="flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm">
            <input type="checkbox" checked={selectedEventIds.includes(eventDefinition.id)} disabled={disabled || lockedEventIds.includes(eventDefinition.id)} onChange={(event) => onToggle(eventDefinition.id, event.target.checked)} />
            {eventDefinition.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
