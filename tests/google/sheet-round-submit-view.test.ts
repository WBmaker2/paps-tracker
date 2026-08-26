import { describe, expect, it } from "vitest";
import { buildRoundSubmitExtras } from "../../src/lib/google/sheet-round-submit-view";
import { FOUR_FACTOR_IDS } from "../../src/lib/paps/four-factor-score";

describe("student round submit shape", () => {
  it("returns finalized factors as a factorId-keyed record", () => {
    const events = ["shuttle-run", "sit-and-reach", "curl-up", "fifty-meter-run"] as const;
    const sessions = events.map((eventId, index) => ({ id: `s${index}`, eventId, assessmentRoundId: "round" }));
    const factors = Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, { factorId, eventId: events[index], sessionId: `s${index}`, representativeAttemptId: `a${index}`, measurement: 10, factorScore: 10 }]));
    const state = {
      sessions,
      assessmentRounds: [{ id: "round", name: "회차", sessionIdsByFactor: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, `s${index}`])), selectedEventsByFactor: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, events[index]])) }],
      attempts: sessions.map((session, index) => ({ id: `a${index}`, sessionId: session.id, studentId: "student", measurement: 10 })),
      representativeSelectionAuditLogs: sessions.map((session, index) => ({ sessionId: session.id, studentId: "student", selectedAttemptId: `a${index}`, createdAt: "2026-01-01" })),
      studentRoundResults: [{ roundId: "round", studentId: "student", revision: 1, status: "finalized", factors, fourFactorSubtotal: 40, normalizedScore: 50, fourFactorGrade: 3, ruleVersion: "v", calculatedAt: "now", finalizedAt: "now" }]
    } as any;
    const result = buildRoundSubmitExtras({ state, sessionId: "s0", studentId: "student", studentName: "학생" });
    expect(Array.isArray(result.roundProgress!.factors)).toBe(true);
    expect(result.roundProgress!.factors.map((factor) => factor.factorId)).toEqual([
      ...FOUR_FACTOR_IDS
    ]);
    expect(Object.keys(result.finalizedResult!.factors)).toEqual([...FOUR_FACTOR_IDS]);
    expect(Array.isArray(result.finalizedResult!.factors)).toBe(false);
  });
});
