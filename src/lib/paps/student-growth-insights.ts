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

const compareAttemptsForChronology = (left: StudentGrowthAttempt, right: StudentGrowthAttempt): number => {
  const createdAtCompare = left.createdAt.localeCompare(right.createdAt);

  if (createdAtCompare !== 0) {
    return createdAtCompare;
  }

  const leftHistory = isHistoryAttempt(left) ? left : null;
  const rightHistory = isHistoryAttempt(right) ? right : null;

  if (leftHistory && rightHistory && leftHistory.sessionId === rightHistory.sessionId) {
    const attemptNumberCompare = left.attemptNumber - right.attemptNumber;

    if (attemptNumberCompare !== 0) {
      return attemptNumberCompare;
    }
  }

  const attemptNumberCompare = left.attemptNumber - right.attemptNumber;

  if (attemptNumberCompare !== 0) {
    return attemptNumberCompare;
  }

  return left.id.localeCompare(right.id);
};

const toSortableAttempts = (attempts: PAPSAttempt[]): StudentGrowthAttempt[] =>
  [...attempts].sort(compareAttemptsForChronology);

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

const resolveSummaryTargetAttemptLabel = (attempt: StudentGrowthAttempt): string =>
  isHistoryAttempt(attempt) ? attempt.sessionName : "이번 기록";

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

const buildSingleRecordSummary = ({ eventLabel, unit }: { eventLabel: string; unit: string }) =>
  `${eventLabel} 측정에서 첫 번째 기록이라 직전 비교가 아직 없습니다. 단위: ${unit}.`;

const buildSummary = ({
  trend,
  previousDeltaText,
  overallDeltaText,
  overallStartLabel,
  overallEndLabel
}: {
  trend: StudentGrowthTrend;
  previousDeltaText: string | null;
  overallDeltaText: string | null;
  overallStartLabel: string;
  overallEndLabel: string;
}): string => {
  if (trend === "same") {
    return `${overallStartLabel}에서 ${overallEndLabel}까지 총 ${overallDeltaText} 변화했고, 직전 기록과 거의 동일했습니다.`;
  }

  if (trend === "mixed") {
    const directionText =
      previousDeltaText === null
        ? "같은 수준입니다."
        : previousDeltaText.startsWith("+")
          ? "좋아졌습니다."
          : previousDeltaText.startsWith("-")
            ? "나빠졌습니다."
            : "같은 수준입니다.";

    return `${overallStartLabel}에서 ${overallEndLabel}까지 총 ${overallDeltaText} 오르내림이 있었고, 직전 기록보다 ${previousDeltaText} ${directionText}`;
  }

  if (trend === "declining") {
    return `${overallStartLabel}에서 ${overallEndLabel}까지 총 ${overallDeltaText} 변화했고, 직전 기록보다 ${previousDeltaText} 나빠졌습니다.`;
  }

  if (trend === "improving") {
    return `${overallStartLabel}에서 ${overallEndLabel}까지 총 ${overallDeltaText} 변화했고, 직전 기록보다 ${previousDeltaText} 좋아졌습니다.`;
  }

  return `${overallStartLabel}에서 ${overallEndLabel}까지 비교 가능한 데이터가 부족해서 요약을 만들지 못했습니다.`;
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

  const sortedAttempts = toSortableAttempts(attempts);
  const initialLatestIndex = resolveLatestAttemptIndex(sortedAttempts, latestAttemptId);
  const latestIndex = initialLatestIndex >= 0 ? initialLatestIndex : sortedAttempts.length - 1;
  const latestAttempt = sortedAttempts[latestIndex];
  const previousAttempt = latestIndex > 0 ? sortedAttempts[latestIndex - 1] : null;

  if (!previousAttempt) {
    return {
      trend: "single",
      summary: buildSingleRecordSummary({ eventLabel, unit }),
      previousDeltaText: null,
      overallDeltaText: null
    };
  }

  const deltas: number[] = [];

  for (let index = 1; index < sortedAttempts.length; index += 1) {
    const current = sortedAttempts[index];
    const previous = sortedAttempts[index - 1];
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
    previous: sortedAttempts[0],
    current: latestAttempt,
    betterDirection
  });
  const previousDeltaText = formatDeltaText(previousDelta, unit);
  const overallDeltaText = formatDeltaText(overallDelta, unit);
  const latestAttemptDisplayLabel = isHistoryAttempt(latestAttempt)
    ? latestAttempt.sessionName
    : "이번 기록";
  const firstAttemptDisplayLabel = resolveSummaryTargetAttemptLabel(sortedAttempts[0]);

  const overallStartLabel = `${firstAttemptDisplayLabel} ${sortedAttempts[0].measurement} ${unit}`;
  const overallEndLabel = `${latestAttemptDisplayLabel} ${latestAttempt.measurement} ${unit}`;

  const summary = buildSummary({
    trend,
    previousDeltaText,
    overallDeltaText,
    overallStartLabel,
    overallEndLabel
  });

  return {
    trend,
    summary,
    previousDeltaText,
    overallDeltaText
  };
}
