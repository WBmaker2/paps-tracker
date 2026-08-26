import { PAPS_EVENT_DEFINITIONS } from "./events";
import { getOfficialGradeRule } from "./grades";
import type {
  EventId,
  GradeLevel,
  OfficialGrade,
  PAPSFourFactorId,
  StudentSex
} from "../../lib/paps/types";

export const PAPS_SCORE_RULE_VERSION = "school-health-rule-2025-03-10-four-factor-v1";
export const PAPS_SCORE_RULE_SOURCE =
  "국가법령정보센터 학교건강검사규칙 별표 4·5 및 2026 나이스 PAPS 매뉴얼";

export type PAPSScoreRuleKey = `${GradeLevel}:${StudentSex}:${EventId}`;

export interface PAPSScoreBand {
  grade: OfficialGrade;
  min: number;
  max: number;
  scoreMin: number;
  scoreMax: number;
}

export interface PAPSScoreRule {
  eventId: EventId;
  factorId: PAPSFourFactorId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
  precision: number;
  betterDirection: "higher" | "lower";
  bands: PAPSScoreBand[];
  outerMin: number;
  outerMax: number;
  fixedScores?: Readonly<Record<OfficialGrade, number>>;
}

const keyOf = (gradeLevel: GradeLevel, sex: StudentSex, eventId: EventId): PAPSScoreRuleKey =>
  `${gradeLevel}:${sex}:${eventId}`;

/* 별표 4의 등급 범위에서 생략된 외곽 끝점(1등급 최대/5등급 최대)을 고정한다. */
const HIGHER_OUTER_MAX: Partial<Record<PAPSScoreRuleKey, number>> = {
  "4:male:shuttle-run": 103,
  "4:female:shuttle-run": 100,
  "5:male:shuttle-run": 107,
  "5:female:shuttle-run": 104,
  "6:male:shuttle-run": 112,
  "6:female:shuttle-run": 112,
  "5:male:sit-and-reach": 18,
  "5:female:sit-and-reach": 22,
  "6:male:sit-and-reach": 18,
  "6:female:sit-and-reach": 26,
  "5:male:step-test": 95,
  "5:female:step-test": 95,
  "6:male:step-test": 95,
  "6:female:step-test": 95,
  "4:male:curl-up": 120,
  "4:female:curl-up": 90,
  "5:male:curl-up": 120,
  "5:female:curl-up": 90,
  "6:male:curl-up": 120,
  "6:female:curl-up": 90,
  "4:male:grip-strength": 36,
  "4:female:grip-strength": 33.6,
  "5:male:grip-strength": 37,
  "5:female:grip-strength": 35,
  "6:male:grip-strength": 39.4,
  "6:female:grip-strength": 39,
  "4:male:standing-long-jump": 179.4,
  "4:female:standing-long-jump": 165.5,
  "5:male:standing-long-jump": 187.4,
  "5:female:standing-long-jump": 175,
  "6:male:standing-long-jump": 204.7,
  "6:female:standing-long-jump": 177.8
};

const HIGHER_OUTER_MIN: Partial<Record<PAPSScoreRuleKey, number>> = {
  "4:male:shuttle-run": 19,
  "4:female:shuttle-run": 16,
  "5:male:shuttle-run": 22,
  "5:female:shuttle-run": 18,
  "6:male:shuttle-run": 22,
  "6:female:shuttle-run": 20,
  "5:male:step-test": 44,
  "5:female:step-test": 44,
  "6:male:step-test": 44,
  "6:female:step-test": 44,
  "5:male:sit-and-reach": -5.1,
  "5:female:sit-and-reach": -0.1,
  "6:male:sit-and-reach": -5.1,
  "6:female:sit-and-reach": -0.1,
  "4:male:curl-up": 0,
  "4:female:curl-up": 0,
  "5:male:curl-up": 0,
  "5:female:curl-up": 0,
  "6:male:curl-up": 0,
  "6:female:curl-up": 0,
  "4:male:grip-strength": 8.9,
  "4:female:grip-strength": 8.5,
  "5:male:grip-strength": 9.9,
  "5:female:grip-strength": 10.6,
  "6:male:grip-strength": 11.2,
  "6:female:grip-strength": 10,
  "4:male:standing-long-jump": 98.2,
  "4:female:standing-long-jump": 87.4,
  "5:male:standing-long-jump": 105.6,
  "5:female:standing-long-jump": 89.3,
  "6:male:standing-long-jump": 112,
  "6:female:standing-long-jump": 89.9
};

const LOWER_OUTER_MAX: Partial<Record<PAPSScoreRuleKey, number>> = {
  "5:male:long-run-walk": 640,
  "5:female:long-run-walk": 640,
  "6:male:long-run-walk": 587,
  "6:female:long-run-walk": 587,
  "4:male:fifty-meter-run": 16.01,
  "4:female:fifty-meter-run": 18.42,
  "5:male:fifty-meter-run": 15.56,
  "5:female:fifty-meter-run": 15.91,
  "6:male:fifty-meter-run": 15.51,
  "6:female:fifty-meter-run": 15.91
};

const LOWER_OUTER_MIN: Partial<Record<PAPSScoreRuleKey, number>> = {
  "5:male:long-run-walk": 268,
  "5:female:long-run-walk": 268,
  "6:male:long-run-walk": 243,
  "6:female:long-run-walk": 243,
  "4:male:fifty-meter-run": 8.7,
  "4:female:fifty-meter-run": 9.3,
  "5:male:fifty-meter-run": 8.3,
  "5:female:fifty-meter-run": 8.73,
  "6:male:fifty-meter-run": 7.77,
  "6:female:fifty-meter-run": 8.66
};

const toUnit = (value: number, precision: number): number =>
  Math.round(value * 10 ** precision);

const fromUnit = (value: number, precision: number): number =>
  value / 10 ** precision;

const scoreBand = (
  grade: OfficialGrade,
  min: number,
  max: number
): PAPSScoreBand => {
  const scoreMin = grade === 5 ? 1 : grade === 4 ? 4 : grade === 3 ? 8 : grade === 2 ? 12 : 16;
  const scoreMax = grade === 5 ? 3 : grade === 4 ? 7 : grade === 3 ? 11 : grade === 2 ? 15 : 19;

  return { grade, min, max, scoreMin, scoreMax };
};

const buildHigherRule = ({
  eventId,
  gradeLevel,
  sex
}: {
  eventId: EventId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
}): PAPSScoreRule | null => {
  const definition = PAPS_EVENT_DEFINITIONS[eventId];
  const officialRule = getOfficialGradeRule(gradeLevel, sex, eventId);
  if (!officialRule || definition.betterDirection !== "higher") return null;

  const key = keyOf(gradeLevel, sex, eventId);
  const outerMax = HIGHER_OUTER_MAX[key];
  if (outerMax === undefined) return null;

  const precision = definition.measurementConstraints.precision;
  const unit = 10 ** -precision;
  const outerMin = HIGHER_OUTER_MIN[key] ?? definition.measurementConstraints.min;
  const orderedBands = [...officialRule.bands].sort((left, right) => right.grade - left.grade);
  const gradeMins = orderedBands.map((band) =>
    band.grade === 5 || !Number.isFinite(band.min) ? outerMin : (band.min as number)
  );
  const bands = orderedBands.map((band, index) => {
    const min = index === 0 ? outerMin + unit : gradeMins[index];
    const max = index === 4 ? outerMax - unit : gradeMins[index + 1] - unit;
    return scoreBand(band.grade, min, max);
  });

  return {
    eventId,
    factorId: definition.factorId,
    gradeLevel,
    sex,
    precision,
    betterDirection: definition.betterDirection,
    bands,
    outerMin,
    outerMax
  };
};

const buildLowerRule = ({
  eventId,
  gradeLevel,
  sex
}: {
  eventId: EventId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
}): PAPSScoreRule | null => {
  const definition = PAPS_EVENT_DEFINITIONS[eventId];
  const officialRule = getOfficialGradeRule(gradeLevel, sex, eventId);
  if (!officialRule || definition.betterDirection !== "lower") return null;

  const key = keyOf(gradeLevel, sex, eventId);
  const outerMax = LOWER_OUTER_MAX[key];
  const outerMin = LOWER_OUTER_MIN[key];
  if (outerMax === undefined || outerMin === undefined) return null;

  const precision = definition.measurementConstraints.precision;
  const unit = 10 ** -precision;
  const gradeMaxes = officialRule.bands.map((band) => band.max as number);
  const bands = officialRule.bands.map((band, index) => {
    const min = index === 0 ? outerMin + unit : gradeMaxes[index - 1] + unit;
    const max = index === 4 ? outerMax - unit : gradeMaxes[index];
    return scoreBand(band.grade, min, max);
  });

  return {
    eventId,
    factorId: definition.factorId,
    gradeLevel,
    sex,
    precision,
    betterDirection: definition.betterDirection,
    bands,
    outerMin,
    outerMax
  };
};

const buildComprehensiveFlexibilityRule = ({
  eventId,
  gradeLevel,
  sex
}: {
  eventId: EventId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
}): PAPSScoreRule | null => {
  const definition = PAPS_EVENT_DEFINITIONS[eventId];
  const officialRule = getOfficialGradeRule(gradeLevel, sex, eventId);
  if (!officialRule || eventId !== "comprehensive-flexibility") return null;

  return {
    eventId,
    factorId: definition.factorId,
    gradeLevel,
    sex,
    precision: definition.measurementConstraints.precision,
    betterDirection: definition.betterDirection,
    bands: [],
    outerMin: definition.measurementConstraints.min,
    outerMax: definition.measurementConstraints.max,
    fixedScores: { 1: 20, 2: 16, 3: 12, 4: 8, 5: 4 }
  };
};

const buildRule = (
  eventId: EventId,
  gradeLevel: GradeLevel,
  sex: StudentSex
): PAPSScoreRule | null =>
  eventId === "comprehensive-flexibility"
    ? buildComprehensiveFlexibilityRule({ eventId, gradeLevel, sex })
    : PAPS_EVENT_DEFINITIONS[eventId].betterDirection === "higher"
      ? buildHigherRule({ eventId, gradeLevel, sex })
      : buildLowerRule({ eventId, gradeLevel, sex });

const allRules = Object.values(PAPS_EVENT_DEFINITIONS).flatMap((definition) =>
  ([4, 5, 6] as GradeLevel[]).flatMap((gradeLevel) =>
    (["male", "female"] as StudentSex[]).flatMap((sex) => {
      const rule = buildRule(definition.id, gradeLevel, sex);
      return rule ? [[keyOf(gradeLevel, sex, definition.id), rule] as const] : [];
    })
  )
);

export const PAPS_SCORE_RULES: Partial<Record<PAPSScoreRuleKey, PAPSScoreRule>> =
  Object.fromEntries(allRules);

export const getPAPSScoreRule = (
  gradeLevel: GradeLevel,
  sex: StudentSex,
  eventId: EventId
): PAPSScoreRule | null => PAPS_SCORE_RULES[keyOf(gradeLevel, sex, eventId)] ?? null;

export const measurementToUnit = toUnit;
export const unitToMeasurement = fromUnit;
