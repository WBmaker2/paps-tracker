import { getEventDefinition } from "../../lib/paps/catalog";
import type { PAPSStudentRoundResult } from "../../lib/paps/types";
import {
  FOUR_FACTOR_IDS,
  type FourFactorStudentResultView
} from "../four-factor-round-types";

/** Maps the server snapshot contract to the deliberately smaller UI contract. */
export const adaptRoundResult = (result: PAPSStudentRoundResult): FourFactorStudentResultView => ({
  roundId: result.roundId,
  studentId: result.studentId,
  studentName: result.studentSnapshot.name,
  status: result.status,
  revision: result.revision,
  factors: Object.fromEntries(
    FOUR_FACTOR_IDS.map((factorId) => {
      const snapshot = result.factors[factorId];
      const event = getEventDefinition(snapshot.eventId);

      return [
        factorId,
        {
          factorId,
          eventId: snapshot.eventId,
          eventLabel: event.label,
          unit: event.unit,
          representativeAttemptId: snapshot.representativeAttemptId,
          measurement: snapshot.measurement,
          factorScore: snapshot.factorScore
        }
      ];
    })
  ) as FourFactorStudentResultView["factors"],
  fourFactorSubtotal: result.fourFactorSubtotal,
  normalizedScore: result.normalizedScore,
  fourFactorGrade: result.fourFactorGrade,
  calculatedAt: result.calculatedAt,
  finalizedAt: result.finalizedAt
});
