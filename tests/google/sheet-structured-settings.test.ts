import { describe, expect, it } from "vitest";

import { parseGoogleSheetStructuredSettings } from "../../src/lib/google/sheet-structured-settings";

describe("Google Sheet structured settings parser", () => {
  it("parses school, teachers, classes, and sessions from machine rows", () => {
    const structuredSettings = parseGoogleSheetStructuredSettings({
      settingsRows: [
        ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
        [
          "__PAPS_SCHOOL",
          "demo-school",
          "Demo Elementary",
          "https://docs.google.com/spreadsheets/d/sheet-123/edit",
          "2026-03-24T09:00:00.000Z",
          "2026-03-24T09:00:00.000Z"
        ],
        [
          "__PAPS_TEACHER",
          "demo-teacher",
          "demo-school",
          "Demo Teacher",
          "demo-teacher@example.com",
          ""
        ],
        [
          "__PAPS_TEACHER_META",
          "demo-teacher",
          "2026-03-24T09:00:00.000Z",
          "2026-03-24T09:00:00.000Z",
          "",
          ""
        ],
        ["__PAPS_CLASS", "class-5-1", "demo-school", "2026", "5", "1"],
        ["__PAPS_CLASS_META", "class-5-1", "5-1", "Y", "", ""],
        [
          "__PAPS_SESSION",
          "session-1",
          "demo-school",
          "demo-teacher",
          "2026",
          "5-1 Shuttle Run"
        ],
        ["__PAPS_SESSION_META", "session-1", "5", "practice", "single", "shuttle-run"],
        ["__PAPS_SESSION_STATUS", "session-1", "Y", "2026-03-24T09:00:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "session-1", "class-5-1", "shuttle-run", "0", ""]
      ],
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com"
    });

    expect(structuredSettings.school).toMatchObject({
      id: "demo-school",
      name: "Demo Elementary"
    });
    expect(structuredSettings.hasPersistedTeachers).toBe(true);
    expect(structuredSettings.teachers).toEqual([
      expect.objectContaining({
        id: "demo-teacher",
        email: "demo-teacher@example.com"
      })
    ]);
    expect(structuredSettings.classes).toEqual([
      expect.objectContaining({
        id: "class-5-1",
        gradeLevel: 5,
        classNumber: 1
      })
    ]);
    expect(structuredSettings.sessions).toEqual([
      expect.objectContaining({
        id: "session-1",
        eventId: "shuttle-run",
        classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }]
      })
    ]);
  });

  it("creates a default teacher when no persisted teacher rows exist", () => {
    const structuredSettings = parseGoogleSheetStructuredSettings({
      settingsRows: [["학교명", "Fallback School", "교사가 관리 페이지에서 설정", "", "", ""]],
      spreadsheetId: "sheet-fallback",
      teacherEmail: "fallback.teacher@example.com"
    });

    expect(structuredSettings.hasPersistedTeachers).toBe(false);
    expect(structuredSettings.school).toMatchObject({
      id: "school-sheet-fallback",
      name: "Fallback School"
    });
    expect(structuredSettings.teachers).toEqual([
      expect.objectContaining({
        schoolId: "school-sheet-fallback",
        email: "fallback.teacher@example.com"
      })
    ]);
    expect(structuredSettings.classes).toEqual([]);
    expect(structuredSettings.sessions).toEqual([]);
  });
});
