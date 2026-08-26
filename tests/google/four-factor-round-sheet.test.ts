import { describe, expect, it, vi } from "vitest";
import { appendFourFactorRoundResult, FOUR_FACTOR_ROUND_HEADER, ensureFourFactorRoundSheet } from "../../src/lib/google/four-factor-round-sheet";
import type { PAPSAssessmentRound, PAPSStudentRoundResult } from "../../src/lib/paps/types";

const round = { id: "r", name: "회차", academicYear: 2026, schoolId: "s", teacherId: "t", roundType: "regular", roundNumber: 1, status: "open", classTargets: [], selectedEventsByFactor: { "cardiorespiratory-endurance": "shuttle-run", flexibility: "sit-and-reach", "strength-endurance": "curl-up", power: "fifty-meter-run" }, sessionIdsByFactor: { "cardiorespiratory-endurance": "a", flexibility: "b", "strength-endurance": "c", power: "d" }, ruleVersion: "v", ruleSource: "test", revision: 1, createdAt: "now", openedAt: "now", finalizedAt: null, archivedAt: null } as PAPSAssessmentRound;
const result = { roundId: "r", studentId: "student", revision: 1, previousRevision: null, status: "finalized", studentSnapshot: { name: "학생", sex: "male", gradeLevel: 5, classId: "class", classNumber: 1, studentNumber: 1 }, factors: { "cardiorespiratory-endurance": { factorId: "cardiorespiratory-endurance", eventId: "shuttle-run", sessionId: "a", representativeAttemptId: "aa", measurement: 30, factorScore: 10 }, flexibility: { factorId: "flexibility", eventId: "sit-and-reach", sessionId: "b", representativeAttemptId: "bb", measurement: 10, factorScore: 10 }, "strength-endurance": { factorId: "strength-endurance", eventId: "curl-up", sessionId: "c", representativeAttemptId: "cc", measurement: 30, factorScore: 10 }, power: { factorId: "power", eventId: "fifty-meter-run", sessionId: "d", representativeAttemptId: "dd", measurement: 10, factorScore: 10 } }, fourFactorSubtotal: 40, normalizedScore: 50, fourFactorGrade: 3, ruleVersion: "v", ruleSource: "test", sourceFingerprint: "fp", calculatedAt: "now", finalizedAt: "now", finalizedBy: "t" } as PAPSStudentRoundResult;

describe("four-factor round sheet schema", () => {
  it("migrates missing tab and dedupes natural-key replay", async () => {
    let tabs: string[] = [];
    const appendRows = vi.fn(async () => ({}));
    const client = {
      getSpreadsheet: vi.fn(async () => ({ spreadsheetId: "sheet", sheets: tabs.map((title, sheetId) => ({ properties: { title, sheetId } })) })),
      readRange: vi.fn(async (_id: string, range: string) => range.includes("A1") ? [Array.from(FOUR_FACTOR_ROUND_HEADER)] : []),
      updateRange: vi.fn(async () => ({})),
      appendRows
    } as any;
    client.addSheet = vi.fn(async (_id: string, title: string) => { tabs.push(title); return { properties: { title, sheetId: 2 } }; });
    await ensureFourFactorRoundSheet({ client, spreadsheetId: "sheet" });
    await appendFourFactorRoundResult({ client, spreadsheetId: "sheet", round, result });
    client.readRange.mockImplementation(async (_id: string, range: string) => range.includes("A1") ? [Array.from(FOUR_FACTOR_ROUND_HEADER)] : [["r", "student", "1"]]);
    await appendFourFactorRoundResult({ client, spreadsheetId: "sheet", round, result });
    expect(appendRows).toHaveBeenCalledTimes(1);
  });
});
