"use client";

import React from "react";

type NamePickerStudent = {
  id: string;
  name: string;
};

export function NamePicker({
  title,
  students,
  selectedStudentId,
  disabled,
  onSelect
}: {
  title: string;
  students: NamePickerStudent[];
  selectedStudentId: string | null;
  disabled?: boolean;
  onSelect: (studentId: string) => void;
}) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink/70">이름을 눌러 본인 차례를 시작하세요.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {students.map((student) => {
          const isSelected = selectedStudentId === student.id;

          return (
            <button
              key={student.id}
              type="button"
              className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                isSelected
                  ? "border-accent bg-accent text-white"
                  : "border-ink/10 bg-canvas/70 text-ink hover:border-accent/40 hover:text-accent"
              } disabled:cursor-not-allowed disabled:opacity-60`}
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelect(student.id)}
            >
              {student.name}
            </button>
          );
        })}
      </div>
    </section>
  );
}
