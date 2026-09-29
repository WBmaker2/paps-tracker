import type {
  BetterDirection,
  PAPSAttempt,
  PAPSStudentEventHistoryAttempt
} from "./types";

export type StudentGrowthTrend = "single" | "improving" | "declining" | "mixed" | "same";

export type StudentGrowthInsight = {
  trend: StudentGrowthTrend;
  summary: string;
  previousDeltaText: string | null;
  overallDeltaText: string | null;
};

type StudentGrowthAttempt = PAPSAttempt | PAPSStudentEventHistoryAttempt;

const MONTH_LABEL_PATTERN = /(\d{1,2}월)/;

const numberFormat = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 3
});

const isHistoryAttempt = (attempt: PAPSAttempt): attempt is PAPSStudentEventHistoryAttempt =>
  "sessionName" in attempt;

const isLatestAttempt = (attempt: StudentGrowthAttempt, latestAttemptId: string | null) =>
  latestAttemptId !== null && attempt.id === latestAttemptId;

const normalizeDelta = (value: number): number => clampNegativeZero(Number(value.toFixed(3)));

const clampNegativeZero = (value: number): number =>
  Object.is(value, -0) ? 0 : value;

const formatDeltaText = (value: number, unit: string): string => {
  const rounded = normalizeDelta(value);

  if (rounded === 0) {
    return `0 ${unit}`;
  }

  return `${rounded > 0 ? "+" : ""}${numberFormat.format(rounded)} ${unit}`;
};

const calculateDirectionalDelta = ({
  previous,
  current,
  betterDirection
}: {
  previous: StudentGrowthAttempt;
  current: StudentGrowthAttempt;
  betterDirection: BetterDirection;
}): number => {
  if (betterDirection === "higher") {
    return current.measurement - previous.measurement;
  }

  return previous.measurement - current.measurement;
};

const resolveLatestAttemptIndex = (attempts: StudentGrowthAttempt[], latestAttemptId: string | null): number =>
  latestAttemptId === null
    ? attempts.length - 1
    : attempts.findIndex((attempt) => isLatestAttempt(attempt, latestAttemptId));

const resolveTrend = (deltas: number[]): StudentGrowthTrend => {
  if (deltas.length === 0) {
    return "single";
  }

  const normalizedDeltas = deltas.map(normalizeDelta);
  const hasPositive = normalizedDeltas.some((delta) => delta > 0);
  const hasNegative = normalizedDeltas.some((delta) => delta < 0);

  if (!hasPositive && !hasNegative) {
    return "same";
  }

  if (hasPositive && !hasNegative) {
    return "improving";
  }

  if (!hasPositive && hasNegative) {
    return "declining";
  }

  return "mixed";
};

const buildSingleRecordSummary = ({ eventLabel }: { eventLabel: string }) =>
  `${eventLabel} 첫 기록이에요. 다음 측정과 비교해 볼 수 있어요.`;

const buildSummary = (trend: StudentGrowthTrend): string => {
  if (trend === "same") {
    return "직전 기록과 같아요. 다음 측정도 기록해 변화를 살펴보세요.";
  }

  if (trend === "mixed") {
    return "측정 기록에 오르내림이 있어요. 이번 기록도 이어서 살펴보세요.";
  }

  if (trend === "declining" || trend === "improving") {
    return "이번 기록을 남겼어요. 다음 측정과 나란히 비교해 보세요.";
  }

  return "기록이 모이면 변화 흐름을 볼 수 있어요.";
};

export const formatStudentAttemptChartLabel = (
  attempt: PAPSAttempt,
  index: number,
  latestAttemptId: string | null
): string => {
  if (isLatestAttempt(attempt, latestAttemptId)) {
    return "이번";
  }

  if (isHistoryAttempt(attempt)) {
    const match = MONTH_LABEL_PATTERN.exec(attempt.sessionName);

    if (match) {
      return match[1];
    }
  }

  return `${index + 1}번째`;
};

export function buildStudentGrowthInsight({
  attempts,
  latestAttemptId,
  betterDirection,
  eventLabel,
  unit
}: {
  attempts: PAPSAttempt[];
  latestAttemptId: string | null;
  betterDirection: BetterDirection;
  eventLabel: string;
  unit: string;
}): StudentGrowthInsight {
  if (attempts.length === 0) {
    return {
      trend: "single",
      summary: `${eventLabel} 측정에서 비교 가능한 기록이 아직 없습니다.`,
      previousDeltaText: null,
      overallDeltaText: null
    };
  }

  const orderedAttempts: StudentGrowthAttempt[] = [...attempts];
  const initialLatestIndex = resolveLatestAttemptIndex(orderedAttempts, latestAttemptId);
  const latestIndex = initialLatestIndex >= 0 ? initialLatestIndex : orderedAttempts.length - 1;
  const latestAttempt = orderedAttempts[latestIndex];
  const previousAttempt = latestIndex > 0 ? orderedAttempts[latestIndex - 1] : null;

  if (!previousAttempt) {
    return {
      trend: "single",
      summary: buildSingleRecordSummary({ eventLabel }),
      previousDeltaText: null,
      overallDeltaText: null
    };
  }

  const deltas: number[] = [];

  for (let index = 1; index < orderedAttempts.length; index += 1) {
    const current = orderedAttempts[index];
    const previous = orderedAttempts[index - 1];
    deltas.push(calculateDirectionalDelta({
      previous,
      current,
      betterDirection
    }));
  }

  const trend = resolveTrend(deltas);
  const previousDelta = calculateDirectionalDelta({
    previous: previousAttempt,
    current: latestAttempt,
    betterDirection
  });
  const overallDelta = calculateDirectionalDelta({
    previous: orderedAttempts[0],
    current: latestAttempt,
    betterDirection
  });
  const previousDeltaText = formatDeltaText(previousDelta, unit);
  const overallDeltaText = formatDeltaText(overallDelta, unit);
  const summary = buildSummary(trend);

  return {
    trend,
    summary,
    previousDeltaText,
    overallDeltaText
  };
}
