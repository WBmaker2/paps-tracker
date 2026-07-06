import { describe, expect, it } from "vitest";

import type { BetterDirection, PAPSStudentEventHistoryAttempt } from "../../src/lib/paps/types";
import {
  buildStudentGrowthInsight,
  formatStudentAttemptChartLabel
} from "../../src/lib/paps/student-growth-insights";

const buildAttempt = ({
  id,
  measurement,
  createdAt,
  sessionName
}: {
  id: string;
  measurement: number;
  createdAt: string;
  sessionName: string;
}): PAPSStudentEventHistoryAttempt => ({
  id,
  attemptNumber: 1,
  measurement,
  createdAt,
  sessionId: "session-common",
  sessionName,
  sessionType: "practice",
  eventId: "sit-and-reach",
  isCurrentSession: false
});

describe("student growth insights", () => {
  it("summarizes steady higher-is-better improvement with expected deltas", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "attempt-3",
        measurement: 16,
        createdAt: "2026-03-03T09:00:00.000Z",
        sessionName: "3월 측정"
      }),
      buildAttempt({
        id: "attempt-4",
        measurement: 21,
        createdAt: "2026-04-03T09:00:00.000Z",
        sessionName: "4월 측정"
      }),
      buildAttempt({
        id: "attempt-7",
        measurement: 24,
        createdAt: "2026-07-03T09:00:00.000Z",
        sessionName: "7월 측정"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: "attempt-7",
      betterDirection: "higher" as BetterDirection,
      eventLabel: "몸무게",
      unit: "cm"
    });

    expect(insight.trend).toBe("improving");
    expect(insight.previousDeltaText).toBe("+3 cm");
    expect(insight.overallDeltaText).toBe("+8 cm");
    expect(insight.summary).toBe(
      "3월 측정 16 cm에서 7월 측정 24 cm까지 총 +8 cm 변화했고, 직전 기록보다 +3 cm 좋아졌습니다."
    );
  });

  it("uses the latest chronological attempt when latestAttemptId is null", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "attempt-july",
        measurement: 24,
        createdAt: "2026-07-03T09:00:00.000Z",
        sessionName: "7월 측정"
      }),
      buildAttempt({
        id: "attempt-march",
        measurement: 16,
        createdAt: "2026-03-03T09:00:00.000Z",
        sessionName: "3월 측정"
      }),
      buildAttempt({
        id: "attempt-april",
        measurement: 21,
        createdAt: "2026-04-03T09:00:00.000Z",
        sessionName: "4월 측정"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: null,
      betterDirection: "higher",
      eventLabel: "몸무게",
      unit: "cm"
    });

    expect(insight.previousDeltaText).toBe("+3 cm");
    expect(insight.overallDeltaText).toBe("+8 cm");
    expect(insight.trend).toBe("improving");
  });

  it("builds higher-is-better decline with clear worse messaging", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "attempt-low",
        measurement: 30,
        createdAt: "2026-01-03T09:00:00.000Z",
        sessionName: "1월 측정"
      }),
      buildAttempt({
        id: "attempt-highest",
        measurement: 24,
        createdAt: "2026-04-03T09:00:00.000Z",
        sessionName: "4월 측정"
      }),
      buildAttempt({
        id: "attempt-last",
        measurement: 12,
        createdAt: "2026-06-03T09:00:00.000Z",
        sessionName: "6월 측정"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: "attempt-last",
      betterDirection: "higher",
      eventLabel: "점수",
      unit: "cm"
    });

    expect(insight.trend).toBe("declining");
    expect(insight.previousDeltaText).toBe("-12 cm");
    expect(insight.overallDeltaText).toBe("-18 cm");
    expect(insight.summary).toContain("직전 기록보다 -12 cm 나빠졌습니다.");
  });

  it("handles lower-is-better improvement with positive delta text", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "run-12-8",
        measurement: 12.8,
        createdAt: "2026-01-01T09:00:00.000Z",
        sessionName: "1월 연습"
      }),
      buildAttempt({
        id: "run-11-9",
        measurement: 11.9,
        createdAt: "2026-01-08T09:00:00.000Z",
        sessionName: "2월 연습"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: "run-11-9",
      betterDirection: "lower",
      eventLabel: "달리기",
      unit: "초"
    });

    expect(insight.trend).toBe("improving");
    expect(insight.previousDeltaText).toBe("+0.9 초");
    expect(insight.overallDeltaText).toBe("+0.9 초");
    expect(insight.summary).toContain("좋아졌습니다");
  });

  it("computes trend from the full chronological series even when latest is in the middle", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "attempt-start",
        measurement: 12,
        createdAt: "2026-01-03T09:00:00.000Z",
        sessionName: "1월 측정"
      }),
      buildAttempt({
        id: "attempt-middle",
        measurement: 18,
        createdAt: "2026-03-03T09:00:00.000Z",
        sessionName: "3월 측정"
      }),
      buildAttempt({
        id: "attempt-end",
        measurement: 14,
        createdAt: "2026-06-03T09:00:00.000Z",
        sessionName: "6월 측정"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: "attempt-middle",
      betterDirection: "higher",
      eventLabel: "점수",
      unit: "cm"
    });

    expect(insight.trend).toBe("mixed");
    expect(insight.previousDeltaText).toBe("+6 cm");
    expect(insight.overallDeltaText).toBe("+6 cm");
    expect(insight.summary).toContain("직전 기록");
  });

  it("builds compact chart labels from month sessions and latest marker", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "chart-3",
        measurement: 10,
        createdAt: "2026-03-01T09:00:00.000Z",
        sessionName: "3월 측정"
      }),
      buildAttempt({
        id: "chart-4",
        measurement: 12,
        createdAt: "2026-04-01T09:00:00.000Z",
        sessionName: "4월 측정"
      }),
      buildAttempt({
        id: "chart-latest",
        measurement: 15,
        createdAt: "2026-05-01T09:00:00.000Z",
        sessionName: "5월 측정"
      })
    ];

    expect(formatStudentAttemptChartLabel(attempts[0], 0, "chart-latest")).toBe("3월");
    expect(formatStudentAttemptChartLabel(attempts[1], 1, "chart-latest")).toBe("4월");
    expect(formatStudentAttemptChartLabel(attempts[2], 2, "chart-latest")).toBe("이번");
  });

  it("rounds floating-point delta artifacts to stable 3-decimal text", () => {
    const attempts: PAPSStudentEventHistoryAttempt[] = [
      buildAttempt({
        id: "float-start",
        measurement: 1,
        createdAt: "2026-01-01T09:00:00.000Z",
        sessionName: "1월 기록"
      }),
      buildAttempt({
        id: "float-end",
        measurement: 1.8000000000000007,
        createdAt: "2026-01-02T09:00:00.000Z",
        sessionName: "2월 기록"
      })
    ];

    const insight = buildStudentGrowthInsight({
      attempts,
      latestAttemptId: "float-end",
      betterDirection: "higher",
      eventLabel: "점수",
      unit: "kg"
    });

    expect(insight.previousDeltaText).toBe("+0.8 kg");
    expect(insight.overallDeltaText).toBe("+0.8 kg");
  });
});
