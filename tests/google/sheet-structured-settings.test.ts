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

  it("parses teacher return PIN metadata from the settings tab", () => {
    const pinConfig = {
      algorithm: "hmac-sha256-v1",
      salt: "salt-value",
      hash: "hash-value",
      updatedAt: "2026-04-21T09:00:00.000Z",
      updatedByTeacherEmail: "teacher@example.com"
    };
    const structuredSettings = parseGoogleSheetStructuredSettings({
      settingsRows: [
        [
          "__PAPS_SCHOOL",
          "demo-school",
          "Demo Elementary",
          "",
          "2026-03-24T09:00:00.000Z",
          "2026-03-24T09:00:00.000Z"
        ],
        [
          "__PAPS_TEACHER_RETURN_PIN",
          JSON.stringify(pinConfig),
          "교사 화면 접근 PIN 해시",
          "",
          "설정",
          "보안"
        ]
      ],
      spreadsheetId: "sheet-123",
      teacherEmail: "teacher@example.com"
    });

    expect(structuredSettings.school.teacherReturnPin).toEqual(pinConfig);
  });

  it("parses session group rows and attaches group metadata to child sessions", () => {
    const structuredSettings = parseGoogleSheetStructuredSettings({
      settingsRows: [
        ["__PAPS_SCHOOL", "demo-school", "Demo Elementary", "", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
        ["__PAPS_TEACHER", "demo-teacher", "demo-school", "Demo Teacher", "demo-teacher@example.com", ""],
        ["__PAPS_CLASS", "class-3-1", "demo-school", "2026", "3", "1"],
        ["__PAPS_CLASS_META", "class-3-1", "3-1", "Y", "", ""],
        ["__PAPS_CLASS", "class-4-1", "demo-school", "2026", "4", "1"],
        ["__PAPS_CLASS_META", "class-4-1", "4-1", "Y", "", ""],
        ["__PAPS_SESSION_GROUP", "group-1", "3월", "demo-school", "demo-teacher", "2026-03-24T09:10:00.000Z"],
        ["__PAPS_SESSION_GROUP_ITEM", "group-1", "session-grip", "0", "grip-strength", ""],
        ["__PAPS_SESSION_GROUP_ITEM", "group-1", "session-jump", "1", "standing-long-jump", ""],
        ["__PAPS_SESSION", "session-grip", "demo-school", "demo-teacher", "2026", "3월 - 악력"],
        ["__PAPS_SESSION_META", "session-grip", "3", "official", "split", "grip-strength"],
        ["__PAPS_SESSION_STATUS", "session-grip", "Y", "2026-03-24T09:10:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "session-grip", "class-3-1", "grip-strength", "0", ""],
        ["__PAPS_SESSION_TARGET", "session-grip", "class-4-1", "grip-strength", "1", ""],
        ["__PAPS_SESSION", "session-jump", "demo-school", "demo-teacher", "2026", "3월 - 제자리멀리뛰기"],
        ["__PAPS_SESSION_META", "session-jump", "3", "official", "split", "standing-long-jump"],
        ["__PAPS_SESSION_STATUS", "session-jump", "Y", "2026-03-24T09:10:00.000Z", "", ""],
        ["__PAPS_SESSION_TARGET", "session-jump", "class-3-1", "standing-long-jump", "0", ""],
        ["__PAPS_SESSION_TARGET", "session-jump", "class-4-1", "standing-long-jump", "1", ""]
      ],
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com"
    });

    expect(structuredSettings.sessions).toEqual([
      expect.objectContaining({
        id: "session-grip",
        sessionGroupId: "group-1",
        sessionGroupName: "3월",
        sessionGroupOrder: 0
      }),
      expect.objectContaining({
        id: "session-jump",
        sessionGroupId: "group-1",
        sessionGroupName: "3월",
        sessionGroupOrder: 1
      })
    ]);
  });
});
