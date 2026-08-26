import {
  getPAPSScoreRule,
  measurementToUnit
} from "../../data/paps/score-rules";
import { getEventDefinition, isEventEligibleForGrade } from "./catalog";
import { calculateOfficialGrade } from "./grade";
import type {
  EventId,
  GradeLevel,
  OfficialGrade,
  PAPSFourFactorId,
  StudentSex
} from "./types";

export const FOUR_FACTOR_IDS: readonly PAPSFourFactorId[] = [
  "cardiorespiratory-endurance",
  "flexibility",
  "strength-endurance",
  "power"
];

export interface EventScoreInput {
  gradeLevel: GradeLevel;
  sex: StudentSex;
  eventId: EventId;
  measurement: number;
}

export interface FourFactorScoreEntry {
  factorId: PAPSFourFactorId;
  score: number;
}

export type FourFactorScores = Record<PAPSFourFactorId, number>;

export interface FourFactorCalculation {
  cardiorespiratoryEndurance: number;
  flexibility: number;
  strengthEndurance: number;
  power: number;
  fourFactorSubtotal: number;
  normalizedScore: number;
  fourFactorGrade: OfficialGrade;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const assertMeasurementPrecision = (measurement: number, precision: number): void => {
  const unitValue = measurementToUnit(measurement, precision);
  if (Math.abs(unitValue / 10 ** precision - measurement) > Number.EPSILON * 10) {
    throw new Error(`측정값은 소수점 ${precision}자리 단위로 입력해야 합니다.`);
  }
};

const getBandScore = ({
  measurement,
  min,
  max,
  scoreMin,
  scoreMax,
  precision
}: {
  measurement: number;
  min: number;
  max: number;
  scoreMin: number;
  scoreMax: number;
  precision: number;
}): number => {
  const minUnit = measurementToUnit(min, precision);
  const maxUnit = measurementToUnit(max, precision);
  const measurementUnit = measurementToUnit(measurement, precision);
  const count = maxUnit - minUnit + 1;
  const parts = scoreMax - scoreMin + 1;

  if (count <= 0 || measurementUnit < minUnit || measurementUnit > maxUnit) {
    throw new Error("점수 규칙의 측정 범위가 올바르지 않습니다.");
  }

  const offset = measurementUnit - minUnit;
  let part = parts - 1;
  for (let index = 1; index < parts; index += 1) {
    if (offset < Math.round((count * index) / parts)) {
      part = index - 1;
      break;
    }
  }

  return scoreMin + part;
};

export const calculateEventScore = ({
  gradeLevel,
  sex,
  eventId,
  measurement
}: EventScoreInput): number => {
  if (!isFiniteNumber(measurement)) {
    throw new Error("점수 계산에는 유한한 측정값이 필요합니다.");
  }

  const definition = getEventDefinition(eventId);
  if (!isEventEligibleForGrade(eventId, gradeLevel)) {
    throw new Error(`Event ${eventId} is not eligible for grade ${gradeLevel}.`);
  }

  const rule = getPAPSScoreRule(gradeLevel, sex, eventId);
  if (!rule) {
    throw new Error(
      `No PAPS score rule exists for grade ${gradeLevel}, sex ${sex}, event ${eventId}.`
    );
  }

  const { min, max, precision } = definition.measurementConstraints;
  if (measurement < min || measurement > max) {
    throw new Error(`측정값이 ${eventId} 허용 범위를 벗어났습니다.`);
  }
  assertMeasurementPrecision(measurement, precision);

  if (rule.fixedScores) {
    const grade = calculateOfficialGrade({ gradeLevel, sex, eventId, measurement });
    return rule.fixedScores[grade];
  }

  if (rule.betterDirection === "higher") {
    if (measurement <= rule.outerMin) return 0;
    if (measurement >= rule.outerMax) return 20;
  } else {
    if (measurement >= rule.outerMax) return 0;
    if (measurement <= rule.outerMin) return 20;
  }

  const band = rule.bands.find(
    (candidate) => measurement >= candidate.min && measurement <= candidate.max
  );
  if (!band) {
    throw new Error(
      `Could not resolve a PAPS score for grade ${gradeLevel}, sex ${sex}, event ${eventId}.`
    );
  }

  const isLowerDirection = rule.betterDirection === "lower";
  return getBandScore({
    measurement: isLowerDirection ? -measurement : measurement,
    min: isLowerDirection ? -band.max : band.min,
    max: isLowerDirection ? -band.min : band.max,
    scoreMin: band.scoreMin,
    scoreMax: band.scoreMax,
    precision
  });
};

const assertFactorScore = (factorId: PAPSFourFactorId, score: unknown): number => {
  if (!isFiniteNumber(score) || !Number.isInteger(score) || score < 0 || score > 20) {
    throw new Error(`요인 ${factorId} 점수는 0~20 사이 정수여야 합니다.`);
  }
  return score;
};

const normalizeFactorScores = (
  input: FourFactorScores | readonly FourFactorScoreEntry[]
): FourFactorScores => {
  const values: Partial<FourFactorScores> = {};

  if (Array.isArray(input)) {
    const entries = input as readonly FourFactorScoreEntry[];
    if (entries.length !== FOUR_FACTOR_IDS.length) {
      throw new Error("4개 요인의 점수가 모두 필요합니다.");
    }
    for (const entry of entries) {
      if (!FOUR_FACTOR_IDS.includes(entry.factorId) || values[entry.factorId] !== undefined) {
        throw new Error("요인 누락 또는 중복으로 4요인 점수를 계산할 수 없습니다.");
      }
      values[entry.factorId] = assertFactorScore(entry.factorId, entry.score);
    }
  } else {
    const scoreMap = input as FourFactorScores;
    const keys = Object.keys(scoreMap);
    if (
      keys.length !== FOUR_FACTOR_IDS.length ||
      keys.some((key) => !FOUR_FACTOR_IDS.includes(key as PAPSFourFactorId))
    ) {
      throw new Error("4개 요인의 점수가 정확히 한 번씩 필요합니다.");
    }
    for (const factorId of FOUR_FACTOR_IDS) {
      if (!(factorId in scoreMap)) {
        throw new Error("요인 누락으로 4요인 점수를 계산할 수 없습니다.");
      }
      values[factorId] = assertFactorScore(factorId, scoreMap[factorId]);
    }
  }

  if (FOUR_FACTOR_IDS.some((factorId) => values[factorId] === undefined)) {
    throw new Error("4개 요인의 점수가 모두 필요합니다.");
  }
  return values as FourFactorScores;
};

export const calculateFourFactorScore = (
  input: FourFactorScores | readonly FourFactorScoreEntry[]
): FourFactorCalculation => {
  const scores = normalizeFactorScores(input);
  const cardiorespiratoryEndurance = scores["cardiorespiratory-endurance"];
  const flexibility = scores.flexibility;
  const strengthEndurance = scores["strength-endurance"];
  const power = scores.power;
  const fourFactorSubtotal =
    cardiorespiratoryEndurance + flexibility + strengthEndurance + power;

  let fourFactorGrade: OfficialGrade;
  if (fourFactorSubtotal >= 64) fourFactorGrade = 1;
  else if (fourFactorSubtotal >= 48) fourFactorGrade = 2;
  else if (fourFactorSubtotal >= 32) fourFactorGrade = 3;
  else if (fourFactorSubtotal >= 16) fourFactorGrade = 4;
  else fourFactorGrade = 5;

  return {
    cardiorespiratoryEndurance,
    flexibility,
    strengthEndurance,
    power,
    fourFactorSubtotal,
    normalizedScore: fourFactorSubtotal * 1.25,
    fourFactorGrade
  };
};

export const calculateFourFactorResult = calculateFourFactorScore;
export const calculatePAPSFactorScore = calculateEventScore;
export const calculateFactorScore = calculateEventScore;
export const calculatePAPSFourFactorScore = calculateFourFactorScore;
