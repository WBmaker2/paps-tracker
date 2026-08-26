import { getEventDefinition } from "./catalog";
import { FOUR_FACTOR_IDS } from "./four-factor-score";
import type {
  PAPSAssessmentRound,
  PAPSStudentRoundResult,
  PAPSStudentRoundSubmitFinalizedResult
} from "./types";

export const buildStudentFinalizedResultView = ({
  result,
  round,
  studentName
}: {
  result: PAPSStudentRoundResult;
  round: PAPSAssessmentRound;
  studentName: string;
}): PAPSStudentRoundSubmitFinalizedResult => ({
  roundId: result.roundId,
  roundName: round.name,
  studentName,
  status: "finalized",
  factors: Object.fromEntries(
    FOUR_FACTOR_IDS.map((factorId) => {
      const factor = result.factors[factorId];
      const event = getEventDefinition(factor.eventId);

      return [factorId, { ...factor, eventLabel: event.label, unit: event.unit }];
    })
  ) as unknown as PAPSStudentRoundSubmitFinalizedResult["factors"],
  fourFactorSubtotal: result.fourFactorSubtotal,
  normalizedScore: result.normalizedScore,
  fourFactorGrade: result.fourFactorGrade,
  ruleVersion: result.ruleVersion,
  calculatedAt: result.calculatedAt,
  finalizedAt: result.finalizedAt
});
