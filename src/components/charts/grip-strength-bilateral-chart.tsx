import React from "react";

import type { PAPSAttempt } from "../../lib/paps/types";
import { isGripStrengthMeasurementDetail } from "../../lib/paps/composite-measurements";

type BilateralGripAttempt = PAPSAttempt & {
  detail: {
    kind: "grip-strength";
    right: number;
    left: number;
  };
};

export function GripStrengthBilateralChart({
  attempts,
  getLabel
}: {
  attempts: PAPSAttempt[];
  getLabel: (attempt: PAPSAttempt, index: number) => string;
}) {
  const orderedAttempts = attempts.filter(
    (attempt): attempt is BilateralGripAttempt => isGripStrengthMeasurementDetail(attempt.detail)
  );

  if (orderedAttempts.length === 0) {
    return null;
  }

  const rightValues = orderedAttempts.map((attempt) => attempt.detail.right);
  const leftValues = orderedAttempts.map((attempt) => attempt.detail.left);
  const measurementMin = Math.min(...rightValues, ...leftValues);
  const measurementMax = Math.max(...rightValues, ...leftValues);
  const range = measurementMax - measurementMin || 1;

  const calculateX = (index: number) => 20 + (index * 200) / Math.max(orderedAttempts.length - 1, 1);
  const calculateY = (measurement: number) => 90 - ((measurement - measurementMin) / range) * 60;

  const rightPoints = orderedAttempts
    .map((attempt, index) => `${calculateX(index)},${calculateY(attempt.detail.right)}`)
    .join(" ");
  const leftPoints = orderedAttempts
    .map((attempt, index) => `${calculateX(index)},${calculateY(attempt.detail.left)}`)
    .join(" ");

  return (
    <div className="rounded-2xl bg-canvas/80 p-4">
      <p className="mb-1 text-sm font-medium text-ink/70">오른손·왼손 추이</p>
      <div className="mb-2 flex items-center gap-4 text-xs text-ink/70">
        <span>오른손</span>
        <span>왼손</span>
      </div>
      <svg
        viewBox="0 0 240 110"
        className="h-28 w-full"
        role="img"
        aria-label="오른손·왼손 악력 추이 차트"
      >
        {orderedAttempts.length > 1 ? (
          <>
            <polyline
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={rightPoints}
            />
            <polyline
              fill="none"
              stroke="#b35c2e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={leftPoints}
            />
          </>
        ) : null}
        {orderedAttempts.map((attempt, index) => {
          const x = calculateX(index);

          return (
            <g key={attempt.id}>
              <circle cx={x} cy={calculateY(attempt.detail.right)} r="5" fill="#2563eb" />
              <circle cx={x} cy={calculateY(attempt.detail.left)} r="5" fill="#b35c2e" />
              <text
                x={x}
                y={105}
                textAnchor="middle"
                fontSize="10"
                fill="#14213d"
              >
                {getLabel(attempt, index)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
