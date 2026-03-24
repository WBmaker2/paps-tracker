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
          "__PAPS_MACHINE_SCHOOL",
          JSON.stringify({
            id: "demo-school",
            name: "Demo Elementary",
            teacherIds: ["demo-teacher"],
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
            createdAt: "2026-03-24T09:00:00.000Z",
            updatedAt: "2026-03-24T09:00:00.000Z"
          }),
          "machine",
          "",
          "",
          ""
        ],
        [
          "__PAPS_MACHINE_CLASSES",
          JSON.stringify([
            {
              id: "class-5-1",
              schoolId: "demo-school",
              academicYear: 2026,
              gradeLevel: 5,
              classNumber: 1,
              label: "5-1",
              active: true
            }
          ]),
          "machine",
          "",
          "",
          ""
        ],
        [
          "__PAPS_MACHINE_TEACHERS",
          JSON.stringify([
            {
              id: "demo-teacher",
              schoolId: "demo-school",
              name: "Demo Teacher",
              email: "demo-teacher@example.com",
              createdAt: "2026-03-24T09:00:00.000Z",
              updatedAt: "2026-03-24T09:00:00.000Z"
            }
          ]),
          "machine",
          "",
          "",
          ""
        ],
        [
          "__PAPS_MACHINE_SESSIONS",
          JSON.stringify([
            {
              id: "session-1",
              schoolId: "demo-school",
              teacherId: "demo-teacher",
              academicYear: 2026,
              name: "5-1 Shuttle Run",
              gradeLevel: 5,
              sessionType: "practice",
              classScope: "single",
              eventId: "shuttle-run",
              classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
              isOpen: true,
              createdAt: "2026-03-24T09:00:00.000Z"
            }
          ]),
          "machine",
          "",
          "",
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
});
