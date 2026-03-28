import type {
  ComprehensiveFlexibilityMeasurementDetail,
  EventId,
  PAPSMeasurementDetail,
  StepTestMeasurementDetail
} from "./types";

const STEP_TEST_DURATION_SECONDS = 180;

const roundUpToPrecision = (value: number, precision: number): number => {
  const multiplier = 10 ** precision;

  return Math.ceil((value - Number.EPSILON) * multiplier) / multiplier;
};

const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";

const isComprehensiveFlexibilitySection = (
  value: unknown
): value is ComprehensiveFlexibilityMeasurementDetail["shoulder"] =>
  Boolean(
    value &&
      typeof value === "object" &&
      isBoolean((value as { right?: unknown }).right) &&
      isBoolean((value as { left?: unknown }).left)
  );

export const isStepTestMeasurementDetail = (
  value: unknown
): value is StepTestMeasurementDetail =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as { kind?: unknown }).kind === "step-test" &&
      Array.isArray((value as { recoveryHeartRates?: unknown }).recoveryHeartRates) &&
      (value as { recoveryHeartRates: unknown[] }).recoveryHeartRates.length === 3 &&
      (value as { recoveryHeartRates: unknown[] }).recoveryHeartRates.every(
        (entry) => Number.isInteger(entry) && Number(entry) >= 0 && Number(entry) <= 240
      )
  );

export const isComprehensiveFlexibilityMeasurementDetail = (
  value: unknown
): value is ComprehensiveFlexibilityMeasurementDetail =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as { kind?: unknown }).kind === "comprehensive-flexibility" &&
      isComprehensiveFlexibilitySection((value as { shoulder?: unknown }).shoulder) &&
      isComprehensiveFlexibilitySection((value as { trunk?: unknown }).trunk) &&
      isComprehensiveFlexibilitySection((value as { side?: unknown }).side) &&
      isComprehensiveFlexibilitySection((value as { lowerBody?: unknown }).lowerBody)
  );

export const parseMeasurementDetail = (value: unknown): PAPSMeasurementDetail | null => {
  if (isStepTestMeasurementDetail(value)) {
    return {
      kind: "step-test",
      recoveryHeartRates: [...value.recoveryHeartRates] as [number, number, number]
    };
  }

  if (isComprehensiveFlexibilityMeasurementDetail(value)) {
    return {
      kind: "comprehensive-flexibility",
      shoulder: { ...value.shoulder },
      trunk: { ...value.trunk },
      side: { ...value.side },
      lowerBody: { ...value.lowerBody }
    };
  }

  return null;
};

const getComprehensiveFlexibilitySectionScore = (
  section: ComprehensiveFlexibilityMeasurementDetail["shoulder"]
): number => Number(section.right) + Number(section.left);

export const deriveCompositeMeasurement = ({
  eventId,
  detail
}: {
  eventId: EventId;
  detail: PAPSMeasurementDetail;
}): {
  measurement: number;
} => {
  if (eventId === "step-test") {
    if (!isStepTestMeasurementDetail(detail)) {
      throw new Error("스텝검사 입력값이 올바르지 않습니다.");
    }

    const pulseSum = detail.recoveryHeartRates.reduce((sum, value) => sum + value, 0);

    if (pulseSum <= 0) {
      throw new Error("스텝검사 심박수 합은 1 이상이어야 합니다.");
    }

    return {
      measurement: roundUpToPrecision(
        (STEP_TEST_DURATION_SECONDS / (2 * pulseSum)) * 100,
        1
      )
    };
  }

  if (eventId === "comprehensive-flexibility") {
    if (!isComprehensiveFlexibilityMeasurementDetail(detail)) {
      throw new Error("종합유연성 입력값이 올바르지 않습니다.");
    }

    return {
      measurement:
        getComprehensiveFlexibilitySectionScore(detail.shoulder) +
        getComprehensiveFlexibilitySectionScore(detail.trunk) +
        getComprehensiveFlexibilitySectionScore(detail.side) +
        getComprehensiveFlexibilitySectionScore(detail.lowerBody)
    };
  }

  throw new Error(`Event ${eventId} does not use composite measurements.`);
};

export const resolveSubmissionMeasurement = ({
  eventId,
  measurement,
  detail
}: {
  eventId: EventId;
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
}): {
  measurement: number;
  detail: PAPSMeasurementDetail | null;
} => {
  if (eventId === "step-test" || eventId === "comprehensive-flexibility") {
    const parsedDetail = parseMeasurementDetail(detail);

    if (!parsedDetail) {
      throw new Error(
        eventId === "step-test"
          ? "스텝검사 세부 기록을 입력해 주세요."
          : "종합유연성 세부 기록을 입력해 주세요."
      );
    }

    return {
      ...deriveCompositeMeasurement({
        eventId,
        detail: parsedDetail
      }),
      detail: parsedDetail
    };
  }

  if (!Number.isFinite(measurement)) {
    throw new Error("A numeric measurement is required.");
  }

  return {
    measurement: Number(measurement),
    detail: null
  };
};

export const formatAttemptDetailSummary = ({
  eventId,
  detail
}: {
  eventId: EventId;
  detail?: PAPSMeasurementDetail | null;
}): string | null => {
  if (eventId === "step-test" && isStepTestMeasurementDetail(detail)) {
    return `회복심박수 ${detail.recoveryHeartRates.join(" / ")}회`;
  }

  if (
    eventId === "comprehensive-flexibility" &&
    isComprehensiveFlexibilityMeasurementDetail(detail)
  ) {
    return [
      `어깨 ${getComprehensiveFlexibilitySectionScore(detail.shoulder)}점`,
      `몸통 ${getComprehensiveFlexibilitySectionScore(detail.trunk)}점`,
      `옆구리 ${getComprehensiveFlexibilitySectionScore(detail.side)}점`,
      `하체 ${getComprehensiveFlexibilitySectionScore(detail.lowerBody)}점`
    ].join(" · ");
  }

  return null;
};
