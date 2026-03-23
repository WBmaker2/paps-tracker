import { getEventDefinition, hasOfficialGradeRule, isEventEligibleForGrade } from "./catalog";
import { getOfficialGradeRule } from "../../data/paps/grades";
import type {
  EventId,
  GradeLevel,
  OfficialGrade,
  OfficialGradeBand,
  StudentSex
} from "./types";

export const validateOfficialGradeBands = ({
  bands,
  betterDirection,
  eventId
}: {
  bands: OfficialGradeBand[];
  betterDirection: "higher" | "lower";
  eventId: EventId;
}): void => {
  for (let index = 1; index < bands.length; index += 1) {
    const previousBand = bands[index - 1];
    const currentBand = bands[index];

    if (
      betterDirection === "higher" &&
      (previousBand.min === undefined ||
        currentBand.min === undefined ||
        previousBand.min <= currentBand.min)
    ) {
      throw new Error(
        `Official grade bands for ${eventId} must be ordered from stricter to looser thresholds.`
      );
    }

    if (
      betterDirection === "lower" &&
      (previousBand.max === undefined ||
        currentBand.max === undefined ||
        previousBand.max >= currentBand.max)
    ) {
      throw new Error(
        `Official grade bands for ${eventId} must be ordered from stricter to looser thresholds.`
      );
    }

    if (currentBand.grade !== previousBand.grade + 1) {
      throw new Error(
        `Official grade bands for ${eventId} must keep grades in ascending ladder order.`
      );
    }
  }
};

export const calculateOfficialGrade = ({
  gradeLevel,
  sex,
  eventId,
  measurement
}: {
  gradeLevel: GradeLevel;
  sex: StudentSex;
  eventId: EventId;
  measurement: number;
}): OfficialGrade => {
  if (!isEventEligibleForGrade(eventId, gradeLevel)) {
    throw new Error(`Event ${eventId} is not eligible for grade ${gradeLevel}.`);
  }

  if (!hasOfficialGradeRule(eventId, gradeLevel, sex)) {
    throw new Error(
      `No official grade rule exists for grade ${gradeLevel}, sex ${sex}, event ${eventId}.`
    );
  }

  const gradeRule = getOfficialGradeRule(gradeLevel, sex, eventId);
  const eventDefinition = getEventDefinition(eventId);

  if (!gradeRule) {
    throw new Error(
      `No official grade rule exists for grade ${gradeLevel}, sex ${sex}, event ${eventId}.`
    );
  }

  validateOfficialGradeBands({
    bands: gradeRule.bands,
    betterDirection: eventDefinition.betterDirection,
    eventId
  });

  const matchedBand = gradeRule.bands.find((band) => {
    if (eventDefinition.betterDirection === "higher") {
      return measurement >= (band.min ?? Number.NEGATIVE_INFINITY);
    }

    return measurement <= (band.max ?? Number.POSITIVE_INFINITY);
  });

  if (!matchedBand) {
    throw new Error(`Could not resolve an official grade for ${eventId}.`);
  }

  return matchedBand.grade;
};
