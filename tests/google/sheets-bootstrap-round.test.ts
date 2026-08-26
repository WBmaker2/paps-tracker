import { describe, expect, it, vi } from "vitest";

import { FOUR_FACTOR_IDS } from "../../src/lib/paps/four-factor-score";
import type { PAPSAssessmentRound, PAPSStudentRoundResult } from "../../src/lib/paps/types";
import { buildFourFactorRoundResultRow } from "../../src/lib/google/four-factor-round-sheet";
import { buildSettingsTabValues } from "../../src/lib/google/sheet-source-tab-values";
import { buildStructuredStateFromSheet } from "../../src/lib/google/sheets-bootstrap";
import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";

const round = {
  id: "round-1",
  name: "회차",
  academicYear: 2026,
  schoolId: "school-1",
  teacherId: "teacher-1",
  roundType: "regular",
  roundNumber: 1,
  status: "open",
  classTargets: [],
  selectedEventsByFactor: {
    "cardiorespiratory-endurance": "shuttle-run",
    flexibility: "sit-and-reach",
    "strength-endurance": "curl-up",
    power: "standing-long-jump"
  },
  sessionIdsByFactor: {
    "cardiorespiratory-endurance": "session-cardio",
    flexibility: "session-flexibility",
    "strength-endurance": "session-strength",
    power: "session-power"
  },
  ruleVersion: "paps-v1",
  ruleSource: "score-rules.ts",
  revision: 1,
  createdAt: "2026-08-26T00:00:00.000Z",
  openedAt: "2026-08-26T00:00:00.000Z",
  finalizedAt: null,
  archivedAt: null
} as PAPSAssessmentRound;

const result = {
  roundId: round.id,
  studentId: "student-1",
  revision: 2,
  previousRevision: 1,
  status: "finalized",
  studentSnapshot: {
    name: "학생",
    sex: "female",
    gradeLevel: 5,
    classId: "class-5-1",
    classNumber: 1,
    studentNumber: 1
  },
  factors: Object.fromEntries(
    FOUR_FACTOR_IDS.map((factorId, index) => [
      factorId,
      {
        factorId,
        eventId: round.selectedEventsByFactor[factorId],
        sessionId: round.sessionIdsByFactor[factorId],
        representativeAttemptId: null,
        measurement: index === 0 ? 0 : null,
        factorScore: index === 0 ? 0 : null
      }
    ])
  ),
  fourFactorSubtotal: 0,
  normalizedScore: 0,
  fourFactorGrade: 5,
  ruleVersion: round.ruleVersion,
  ruleSource: round.ruleSource,
  sourceFingerprint: null,
  calculatedAt: "2026-08-26T00:01:00.000Z",
  finalizedAt: "2026-08-26T00:02:00.000Z",
  finalizedBy: "teacher-1"
} as PAPSStudentRoundResult;

const buildClient = (settingsRows: string[][], roundRows: string[][]): GoogleSheetsClient => ({
  getSpreadsheet: vi.fn(async () => ({ spreadsheetId: "sheet-1", sheets: [] })),
  readRange: vi.fn(async () => []),
  readRanges: vi.fn(async (_spreadsheetId, ranges) =>
    ranges.length === 5 ? [settingsRows, [], [], [], []] : [roundRows]
  ),
  appendRows: vi.fn(async () => ({})),
  updateRange: vi.fn(async () => ({}))
});

describe("Google Sheets round result bootstrap boundaries", () => {
  it("preserves zero scores, null measurements, and revision linkage from a serialized row", async () => {
    const settingsRows = buildSettingsTabValues({
      spreadsheetId: "sheet-1",
      school: {
        id: "school-1",
        name: "학교",
        teacherIds: ["teacher-1"],
        sheetUrl: null,
        createdAt: "2026-08-26T00:00:00.000Z",
        updatedAt: "2026-08-26T00:00:00.000Z"
      },
      classes: [],
      teachers: [],
      sessions: [],
      assessmentRounds: [round]
    }).slice(1);
    const serializedRow = buildFourFactorRoundResultRow(round, result).map((cell) =>
      cell === null ? "" : String(cell)
    );

    const state = await buildStructuredStateFromSheet({
      client: buildClient(settingsRows, [serializedRow]),
      spreadsheetId: "sheet-1",
      teacherEmail: "teacher@example.com"
    });
    const parsed = state.studentRoundResults[0]!;

    expect(parsed.revision).toBe(2);
    expect(parsed.previousRevision).toBe(1);
    expect(parsed.factors["cardiorespiratory-endurance"]?.measurement).toBe(0);
    expect(parsed.factors["cardiorespiratory-endurance"]?.factorScore).toBe(0);
    expect(parsed.factors.flexibility?.measurement).toBeNull();
    expect(parsed.factors.flexibility?.factorScore).toBeNull();
    expect(parsed.fourFactorSubtotal).toBe(0);
    expect(parsed.normalizedScore).toBe(0);
    expect(parsed.fourFactorGrade).toBe(5);
  });
});
