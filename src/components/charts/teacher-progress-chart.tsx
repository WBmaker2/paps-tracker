import React from "react";

import type { PAPSAttempt } from "../../lib/paps/types";

export function TeacherProgressChart({
  title,
  attempts,
  unit
}: {
  title: string;
  attempts: PAPSAttempt[];
  unit: string;
}) {
  if (attempts.length === 0) {
    return (
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-ink/70">아직 기록된 시도가 없어 그래프를 표시할 수 없습니다.</p>
      </section>
    );
  }

  const maxMeasurement = Math.max(...attempts.map((attempt) => attempt.measurement), 1);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink/70">시도별 측정값 흐름을 한눈에 확인합니다.</p>
      </div>
      <svg viewBox="0 0 360 180" className="h-48 w-full">
        {attempts.map((attempt, index) => {
          const width = 70;
          const x = 32 + index * 98;
          const barHeight = (attempt.measurement / maxMeasurement) * 110;
          const y = 150 - barHeight;

          return (
            <g key={attempt.id}>
              <rect
                x={x}
                y={y}
                width={width}
                height={barHeight}
                rx="16"
                fill={index === attempts.length - 1 ? "#b35c2e" : "#dbe7e4"}
              />
              <text x={x + width / 2} y={166} textAnchor="middle" fontSize="12" fill="#14213d">
                {attempt.attemptNumber}회차
              </text>
              <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize="12" fill="#14213d">
                {attempt.measurement} {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
