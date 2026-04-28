import React from "react";

import type { PAPSAttempt } from "../../lib/paps/types";

export function TeacherProgressChart({
  title,
  attempts,
  unit,
  description = "시도별 측정값 흐름을 한눈에 확인합니다.",
  getLabel = (attempt) => `${attempt.attemptNumber}회차`
}: {
  title: string;
  attempts: PAPSAttempt[];
  unit: string;
  description?: string;
  getLabel?: (attempt: PAPSAttempt, index: number) => string;
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
  const barWidth = 64;
  const stepWidth = 92;
  const chartWidth = Math.max(360, 64 + attempts.length * stepWidth);

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-ink/70">{description}</p>
      </div>
      <svg viewBox={`0 0 ${chartWidth} 180`} className="h-48 w-full">
        {attempts.map((attempt, index) => {
          const x = 32 + index * stepWidth;
          const barHeight = (attempt.measurement / maxMeasurement) * 110;
          const y = 150 - barHeight;

          return (
            <g key={attempt.id}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="16"
                fill={index === attempts.length - 1 ? "#b35c2e" : "#dbe7e4"}
              />
              <text x={x + barWidth / 2} y={166} textAnchor="middle" fontSize="12" fill="#14213d">
                {getLabel(attempt, index)}
              </text>
              <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize="12" fill="#14213d">
                {attempt.measurement} {unit}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
