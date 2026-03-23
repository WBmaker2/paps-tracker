import React from "react";

import type { PAPSAttempt } from "../../lib/paps/types";

export function ProgressMiniChart({
  attempts,
  unit
}: {
  attempts: PAPSAttempt[];
  unit: string;
}) {
  if (attempts.length === 0) {
    return null;
  }

  if (attempts.length === 1) {
    return (
      <div className="rounded-2xl bg-canvas/80 px-4 py-5 text-sm text-ink/70">
        첫 기록입니다: {attempts[0]?.measurement} {unit}
      </div>
    );
  }

  const measurements = attempts.map((attempt) => attempt.measurement);
  const minimum = Math.min(...measurements);
  const maximum = Math.max(...measurements);
  const range = maximum - minimum || 1;
  const points = attempts
    .map((attempt, index) => {
      const x = 20 + (index * 200) / Math.max(attempts.length - 1, 1);
      const y = 90 - ((attempt.measurement - minimum) / range) * 60;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl bg-canvas/80 p-4">
      <p className="mb-3 text-sm font-medium text-ink/70">개인 추이</p>
      <svg viewBox="0 0 240 110" className="h-28 w-full" aria-label="개인 추이 차트">
        <polyline
          fill="none"
          stroke="#b35c2e"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        {attempts.map((attempt, index) => {
          const x = 20 + (index * 200) / Math.max(attempts.length - 1, 1);
          const y = 90 - ((attempt.measurement - minimum) / range) * 60;

          return (
            <g key={attempt.id}>
              <circle cx={x} cy={y} r="5" fill="#14213d" />
              <text x={x} y={105} textAnchor="middle" fontSize="10" fill="#14213d">
                {attempt.attemptNumber}회
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
