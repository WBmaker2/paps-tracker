"use client";

import React from "react";

import type { EventId, GradeLevel } from "../../lib/paps/types";
import type { TeacherResultFilterOptions } from "../../lib/teacher-results";

export interface TeacherResultsFilterState {
  query: string;
  grade: "all" | GradeLevel;
  classId: "all" | string;
  eventId: "all" | EventId;
  sessionType: "all" | "official" | "practice";
}

export function ResultsFilterPanel({
  value,
  options,
  onChange,
  onReset
}: {
  value: TeacherResultsFilterState;
  options: TeacherResultFilterOptions;
  onChange: (nextValue: TeacherResultsFilterState) => void;
  onReset: () => void;
}) {
  const availableClasses =
    value.grade === "all"
      ? options.classes
      : options.classes.filter((classroom) => classroom.gradeLevel === value.grade);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">검색 및 필터</h2>
          <p className="mt-1 text-sm text-ink/70">
            학년, 반, 종목, 세션 유형으로 결과를 빠르게 좁혀 볼 수 있습니다.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
          onClick={onReset}
          aria-label="상단 필터 초기화"
        >
          필터 초기화
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="md:col-span-2">
          <span className="mb-1 block text-sm font-medium text-ink/80">학생명 검색</span>
          <input
            value={value.query}
            onChange={(event) =>
              onChange({
                ...value,
                query: event.target.value
              })
            }
            placeholder="학생 이름으로 검색"
            className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm outline-none transition focus:border-accent/40"
          />
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">학년</span>
          <select
            value={value.grade}
            onChange={(event) => {
              const nextGrade =
                event.target.value === "all" ? "all" : (Number(event.target.value) as GradeLevel);
              const nextClasses =
                nextGrade === "all"
                  ? options.classes
                  : options.classes.filter((classroom) => classroom.gradeLevel === nextGrade);
              const isClassStillValid =
                value.classId === "all" ||
                nextClasses.some((classroom) => classroom.value === value.classId);

              onChange({
                ...value,
                grade: nextGrade,
                classId: isClassStillValid ? value.classId : "all"
              });
            }}
            className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm outline-none transition focus:border-accent/40"
          >
            <option value="all">전체 학년</option>
            {options.grades.map((grade) => (
              <option key={grade.value} value={grade.value}>
                {grade.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">반</span>
          <select
            value={value.classId}
            onChange={(event) =>
              onChange({
                ...value,
                classId: event.target.value
              })
            }
            className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm outline-none transition focus:border-accent/40"
          >
            <option value="all">전체 반</option>
            {availableClasses.map((classroom) => (
              <option key={classroom.value} value={classroom.value}>
                {classroom.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-sm font-medium text-ink/80">종목</span>
          <select
            value={value.eventId}
            onChange={(event) =>
              onChange({
                ...value,
                eventId: event.target.value as TeacherResultsFilterState["eventId"]
              })
            }
            className="w-full rounded-2xl border border-ink/10 px-4 py-3 text-sm outline-none transition focus:border-accent/40"
          >
            <option value="all">전체 종목</option>
            {options.events.map((eventOption) => (
              <option key={eventOption.value} value={eventOption.value}>
                {eventOption.label}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-sm font-medium text-ink/80">세션 유형</span>
          <div className="flex flex-wrap gap-2">
            {options.sessionTypes.map((sessionType) => {
              const active = value.sessionType === sessionType.value;

              return (
                <button
                  key={sessionType.value}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-ink/15 text-ink"
                  }`}
                  onClick={() =>
                    onChange({
                      ...value,
                      sessionType: sessionType.value
                    })
                  }
                >
                  {sessionType.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
