import React from "react";

import type { PAPSClassroom } from "../../lib/paps/types";
import { LiveStatus } from "../ui/live-status";

type ManagedClassroomItem = PAPSClassroom & { optimistic?: boolean };

export function SettingsClassManagementCard({
  classes,
  gradeLevel,
  classNumber,
  message,
  pending,
  onGradeLevelChange,
  onClassNumberChange,
  onAdd
}: {
  classes: ManagedClassroomItem[];
  gradeLevel: string;
  classNumber: string;
  message: string | null;
  pending: boolean;
  onGradeLevelChange: (value: string) => void;
  onClassNumberChange: (value: string) => void;
  onAdd: () => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">학급 관리</h2>
          <p className="mt-1 text-sm text-ink/70">새 학급을 추가하고 현재 학급 편성을 확인합니다.</p>
        </div>
        {message ? <LiveStatus className="text-sm text-ink/70">{message}</LiveStatus> : null}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          새 학급 학년
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={gradeLevel}
            onChange={(event) => onGradeLevelChange(event.target.value)}
          >
            {[3, 4, 5, 6].map((item) => (
              <option key={item} value={item}>
                {item}학년
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          반(숫자입력)
          <input
            inputMode="numeric"
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={classNumber}
            onChange={(event) => onClassNumberChange(event.target.value.replace(/\D/g, ""))}
          />
        </label>
      </div>
      <button
        type="button"
        className="mt-4 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onAdd}
        disabled={pending}
      >
        {pending ? "학급 저장 중..." : "학급 추가"}
      </button>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {classes.map((classroom) => (
          <article key={classroom.id} className="rounded-2xl border border-ink/10 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{classroom.label}</p>
              {classroom.optimistic ? (
                <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
                  저장 중
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink/65">
              {classroom.gradeLevel}학년 · {classroom.academicYear}학년도
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
