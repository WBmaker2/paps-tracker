import { describe, expect, it, vi } from "vitest";

import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "../../src/lib/google/template";
import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";
import { buildTeacherBootstrapFromSheet } from "../../src/lib/google/sheets-bootstrap";

const createSpreadsheet = () => ({
  spreadsheetId: "sheet-123",
  sheets: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab, index) => ({
    properties: {
      sheetId: index + 1,
      title: tab.tabName
    }
  }))
});

const createClient = (): GoogleSheetsClient => ({
  getSpreadsheet: vi.fn(async () => createSpreadsheet()),
  readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
    if (range === "'설정'!A2:F200") {
      return [
        ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
        ["담당교사 이메일", "demo-teacher@example.com", "구글 로그인 계정", "", "", ""],
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
        [
          "__PAPS_CLASS",
          "class-5-1",
          "demo-school",
          "2026",
          "5",
          "1"
        ],
        [
          "__PAPS_CLASS_META",
          "class-5-1",
          "5-1",
          "Y",
          "",
          ""
        ],
        [
          "__PAPS_SESSION",
          "session-1",
          "demo-school",
          "demo-teacher",
          "2026",
          "5-1 Shuttle Run"
        ],
        [
          "__PAPS_SESSION_META",
          "session-1",
          "5",
          "practice",
          "single",
          "shuttle-run"
        ],
        [
          "__PAPS_SESSION_STATUS",
          "session-1",
          "Y",
          "2026-03-24T09:00:00.000Z",
          "",
          ""
        ],
        [
          "__PAPS_SESSION_TARGET",
          "session-1",
          "class-5-1",
          "shuttle-run",
          "0",
          ""
        ]
      ];
    }

    if (range === "'학생명단'!A2:I1000") {
      return [
        ["student-1", "2026", "5", "1", "1", "Kim", "여", "Y", ""],
        ["student-2", "2026", "5", "1", "2", "Lee", "남", "N", ""]
      ];
    }

    return [];
  }),
  appendRows: vi.fn(async () => ({})),
  updateRange: vi.fn(async () => ({}))
});

describe("Google Sheets bootstrap", () => {
  it("builds teacher bootstrap state from 설정/학생명단/세션 tabs", async () => {
    const bootstrap = await buildTeacherBootstrapFromSheet({
      client: createClient(),
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com"
    });

    expect(bootstrap.teacher?.email).toBe("demo-teacher@example.com");
    expect(bootstrap.school?.id).toBe("demo-school");
    expect(bootstrap.classes).toHaveLength(1);
    expect(bootstrap.sessions).toHaveLength(1);
    expect(bootstrap.students.map((student) => student.id)).toEqual(["student-1"]);
  });

  it("filters inactive students out of selection lists", async () => {
    const bootstrap = await buildTeacherBootstrapFromSheet({
      client: createClient(),
      spreadsheetId: "sheet-123",
      teacherEmail: "demo-teacher@example.com"
    });

    expect(bootstrap.students.every((student) => student.active !== false)).toBe(true);
  });

  it("does not inject a synthetic teacher when persisted teacher membership exists for another email", async () => {
    const bootstrap = await buildTeacherBootstrapFromSheet({
      client: createClient(),
      spreadsheetId: "sheet-123",
      teacherEmail: "outsider@example.com"
    });

    expect(bootstrap.teacher).toBeNull();
    expect(bootstrap.school).toBeNull();
    expect(bootstrap.schools).toEqual([]);
    expect(bootstrap.classes).toEqual([]);
    expect(bootstrap.students).toEqual([]);
    expect(bootstrap.sessions).toEqual([]);
  });
});
