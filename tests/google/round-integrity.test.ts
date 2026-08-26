import { describe, expect, it, vi } from "vitest";
import { buildSettingsTabValues } from "../../src/lib/google/sheet-source-tab-values";
import { PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION } from "../../src/lib/google/template";
import { ensureFourFactorRoundSheet, FOUR_FACTOR_ROUND_HEADER } from "../../src/lib/google/four-factor-round-sheet";
import { assertUniqueRoundClassTargets, hasRoundSessionStructureChange } from "../../src/lib/paps/assessment-round";
import { parseGoogleSheetStructuredSettings } from "../../src/lib/google/sheet-structured-settings";
import { FOUR_FACTOR_IDS } from "../../src/lib/paps/four-factor-score";

describe("four-factor round storage integrity", () => {
  it("preserves assessment round metadata and v0.2 settings on rewrites", () => {
    const values = buildSettingsTabValues({
      spreadsheetId: "sheet",
      school: { id: "school", name: "학교", teacherIds: [], sheetUrl: null, createdAt: "now", updatedAt: "now" },
      classes: [], teachers: [], sessions: [],
      assessmentRounds: [{ id: "round", name: "회차", academicYear: 2026, schoolId: "school", teacherId: "teacher", roundType: "regular", roundNumber: 1, status: "open", classTargets: [], selectedEventsByFactor: {} as never, sessionIdsByFactor: {} as never, ruleVersion: "v", ruleSource: "test", revision: 1, createdAt: "now", openedAt: "now", finalizedAt: null, archivedAt: null }]
    });
    expect(values.find((row) => row[0] === "시트 템플릿 버전")?.[1]).toBe(PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION);
    expect(values.find((row) => row[0] === "__PAPS_ASSESSMENT_ROUND")?.[1]).toContain('"id":"round"');
  });

  it("round-trips round JSON and linked session factor metadata through settings", () => {
    const selectedEventsByFactor = {
      "cardiorespiratory-endurance": "shuttle-run",
      flexibility: "sit-and-reach",
      "strength-endurance": "curl-up",
      power: "standing-long-jump"
    } as const;
    const session = {
      id: "session-flexibility",
      schoolId: "school",
      teacherId: "teacher",
      academicYear: 2026,
      name: "회차 - 유연성",
      gradeLevel: 5,
      sessionType: "official" as const,
      classScope: "single" as const,
      eventId: "sit-and-reach" as const,
      classTargets: [{ classId: "class-5-1", eventId: "sit-and-reach" as const }],
      sessionGroupId: "round-1",
      sessionGroupName: "회차",
      sessionGroupOrder: 1,
      assessmentRoundId: "round-1",
      factorId: "flexibility" as const,
      isOpen: true,
      createdAt: "2026-08-26T00:00:00.000Z"
    };
    const round = {
      id: "round-1",
      name: "회차",
      academicYear: 2026,
      schoolId: "school",
      teacherId: "teacher",
      roundType: "regular" as const,
      roundNumber: 1,
      status: "open" as const,
      classTargets: [{ classId: "class-5-1", gradeLevel: 5 as const }],
      selectedEventsByFactor,
      sessionIdsByFactor: {
        "cardiorespiratory-endurance": "session-cardio",
        flexibility: "session-flexibility",
        "strength-endurance": "session-strength",
        power: "session-power"
      },
      ruleVersion: "paps-v1",
      ruleSource: "score-rules.ts",
      revision: 2,
      createdAt: "2026-08-26T00:00:00.000Z",
      openedAt: "2026-08-26T00:00:00.000Z",
      finalizedAt: null,
      archivedAt: null
    };
    const values = buildSettingsTabValues({
      spreadsheetId: "sheet",
      school: { id: "school", name: "학교", teacherIds: ["teacher"], sheetUrl: null, createdAt: "now", updatedAt: "now" },
      classes: [{ id: "class-5-1", schoolId: "school", academicYear: 2026, gradeLevel: 5, classNumber: 1, label: "5-1", active: true }],
      teachers: [{ id: "teacher", schoolId: "school", name: "교사", email: "teacher@example.com", createdAt: "now", updatedAt: "now" }],
      sessions: [session],
      assessmentRounds: [round]
    });

    const parsed = parseGoogleSheetStructuredSettings({ settingsRows: values.slice(1), spreadsheetId: "sheet", teacherEmail: "teacher@example.com" });
    expect(parsed.assessmentRounds).toHaveLength(1);
    expect(parsed.assessmentRounds[0]).toMatchObject({ id: "round-1", revision: 2, name: "회차" });
    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.sessions[0]).toMatchObject({ assessmentRoundId: "round-1", factorId: "flexibility" });
    expect(Object.keys(parsed.assessmentRounds[0]!.selectedEventsByFactor)).toEqual(FOUR_FACTOR_IDS);
  });

  it("creates the round tab/header once and keeps replay append-free", async () => {
    let titles: string[] = [];
    const client = {
      getSpreadsheet: vi.fn(async () => ({ spreadsheetId: "sheet", sheets: titles.map((title, index) => ({ properties: { title, sheetId: index } })) })),
      addSheet: vi.fn(async (_id: string, title: string) => { titles = [...titles, title]; return { properties: { title, sheetId: 9 } }; }),
      updateRange: vi.fn(async () => ({})),
      readRange: vi.fn(async (_id: string, range: string) => range.includes("A1") ? [Array.from(FOUR_FACTOR_ROUND_HEADER)] : [])
    } as any;
    await ensureFourFactorRoundSheet({ client, spreadsheetId: "sheet" });
    await ensureFourFactorRoundSheet({ client, spreadsheetId: "sheet" });
    expect(client.addSheet).toHaveBeenCalledTimes(1);
    expect(client.updateRange).toHaveBeenCalledTimes(2);
  });

  it("locks linked-session structure while allowing name/open changes", () => {
    const current = { gradeLevel: 5, eventId: "shuttle-run", sessionType: "official", classScope: "single", classTargets: [{ classId: "class", eventId: "shuttle-run" }] } as any;
    expect(hasRoundSessionStructureChange(current, { ...current, name: "새 이름", isOpen: false })).toBe(false);
    expect(hasRoundSessionStructureChange(current, { ...current, gradeLevel: 6 })).toBe(true);
    expect(hasRoundSessionStructureChange(current, { ...current, eventId: "long-run-walk", classTargets: [{ classId: "class", eventId: "long-run-walk" }] })).toBe(true);
  });

  it("rejects duplicate class targets as an invalid request", () => {
    expect(() => assertUniqueRoundClassTargets([{ classId: "class-1" }, { classId: "class-1" }])).toThrow("INVALID_REQUEST");
    expect(() => assertUniqueRoundClassTargets([{ classId: "class-1" }, { classId: "class-2" }])).not.toThrow();
  });
});
