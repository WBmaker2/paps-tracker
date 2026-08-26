import { getEventDefinition } from "../paps/catalog";
import { FOUR_FACTOR_IDS } from "../paps/four-factor-score";
import type { GoogleSheetStructuredState } from "./sheets-bootstrap";
import type { PAPSStudentRoundSubmitFactors, PAPSStudentRoundSubmitProgress, PAPSStudentRoundSubmitFinalizedResult } from "../paps/types";

export const buildRoundSubmitExtras = (input: {
  state: GoogleSheetStructuredState;
  sessionId: string;
  studentId: string;
  studentName: string;
}) => {
  const session = input.state.sessions.find((entry) => entry.id === input.sessionId);
  const round = session?.assessmentRoundId
    ? input.state.assessmentRounds.find((entry) => entry.id === session.assessmentRoundId) ?? null
    : null;
  if (!round) return {};
  const latestResult = input.state.studentRoundResults
    .filter((entry) => entry.roundId === round.id && entry.studentId === input.studentId)
    .sort((left, right) => right.revision - left.revision)[0] ?? null;
  const factors = FOUR_FACTOR_IDS.map((factorId) => {
    const factorSessionId = round.sessionIdsByFactor[factorId];
    const sessionAttempts = input.state.attempts.filter((attempt) => attempt.sessionId === factorSessionId && attempt.studentId === input.studentId);
    const selection = input.state.representativeSelectionAuditLogs.filter((entry) => entry.sessionId === factorSessionId && entry.studentId === input.studentId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const representativeAttemptId = selection?.selectedAttemptId ?? null;
    const attempt = sessionAttempts.find((entry) => entry.id === representativeAttemptId) ?? null;
    const eventId = round.selectedEventsByFactor[factorId];
    const event = getEventDefinition(eventId);
    return { factorId, eventId, eventLabel: event.label, unit: event.unit, representativeAttemptId, measurement: attempt?.measurement ?? null, factorScore: latestResult?.factors?.[factorId]?.factorScore ?? null, measured: sessionAttempts.length > 0 };
  });
  const complete = factors.every((factor) => factor.measured);
  const progress: PAPSStudentRoundSubmitProgress = {
    roundId: round.id,
    roundName: round.name,
    status: latestResult?.status ?? (complete ? "ready" : "incomplete"),
    factors: factors.map(({ factorId, eventId, eventLabel, measured }) => ({
      factorId,
      eventId,
      eventLabel,
      complete: measured
    })),
    roundProgress: { completed: factors.filter((factor) => factor.measured).length, total: 4, nextFactorId: factors.find((factor) => !factor.measured)?.factorId ?? null, nextEventLabel: factors.find((factor) => !factor.measured)?.eventLabel ?? null }
  };
  const unchangedFinal = latestResult?.status === "finalized" && latestResult.factors && factors.every((factor) => latestResult.factors[factor.factorId]?.representativeAttemptId === factor.representativeAttemptId && latestResult.factors[factor.factorId]?.measurement === factor.measurement);
  const finalizedFactors = Object.fromEntries(factors.map(({ measured: _measured, ...factor }) => [factor.factorId, factor])) as PAPSStudentRoundSubmitFactors;
  const finalizedResult: PAPSStudentRoundSubmitFinalizedResult | null = unchangedFinal && latestResult ? { roundId: round.id, roundName: round.name, studentName: input.studentName, status: "finalized", factors: finalizedFactors, fourFactorSubtotal: latestResult.fourFactorSubtotal, normalizedScore: latestResult.normalizedScore, fourFactorGrade: latestResult.fourFactorGrade, ruleVersion: latestResult.ruleVersion, calculatedAt: latestResult.calculatedAt, finalizedAt: latestResult.finalizedAt } : null;
  return { roundProgress: progress, finalizedResult };
};
