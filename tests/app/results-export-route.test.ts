import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

vi.mock("../../src/lib/google/sheets", () => ({
  createPapsGoogleSheetTabPayloads: vi.fn(() => [
    {
      tabName: "학생요약",
      header: ["학생ID", "이름", "학생표시문구"],
      rows: [["student-kim", "홍길동", "지난 기록 대비 +2cm"]]
    },
    {
      tabName: "공식평가요약",
      header: ["학생ID", "이름", "공식등급"],
      rows: [["student-kim", "홍길동", 3]]
    },
    {
      tabName: "오류로그",
      header: ["id"],
      rows: []
    }
  ])
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState: vi.fn(async () => ({
    sheetConnected: true,
    store: null,
    bootstrap: {
      teacher: {
        id: "teacher-1",
        schoolId: "school-1"
      },
      school: {
        id: "school-1",
        name: "PAPS Demo School"
      },
      schools: [],
      classes: [],
      teachers: [
        {
          id: "teacher-1",
          schoolId: "school-1",
          name: "Demo Teacher",
          email: "demo-teacher@example.com",
          createdAt: "2026-03-29T09:00:00.000Z",
          updatedAt: "2026-03-29T09:00:00.000Z"
        }
      ],
      students: [],
      sessions: [],
      attempts: [],
      syncStatuses: [],
      syncErrorLogs: [],
      representativeSelectionAuditLogs: []
    }
  }))
}));

describe("results xlsx export route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns a workbook response with student and official summary sheets", async () => {
    const route = await import("../../app/api/results/export.xlsx/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/results/export.xlsx", {
        headers: {
          cookie: "paps-spreadsheet-id=sheet-live"
        }
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(response.headers.get("content-disposition")).toContain("summary-export.xlsx");

    const workbook = XLSX.read(Buffer.from(await response.arrayBuffer()), {
      type: "buffer"
    });

    expect(workbook.SheetNames).toEqual(["학생요약", "공식평가요약"]);
    expect(workbook.Sheets["학생요약"]?.B2?.v).toBe("홍길동");
    expect(workbook.Sheets["공식평가요약"]?.C2?.v).toBe(3);
  });
});
