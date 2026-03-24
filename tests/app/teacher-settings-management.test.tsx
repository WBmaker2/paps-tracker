import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStore } from "../../src/lib/demo-store";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";
import { GoogleSheetsAccessError } from "../../src/lib/google/sheets-client";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

vi.mock("../../src/lib/google/sheets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/google/sheets-client")>();

  return {
    ...actual,
    createGoogleSheetsClient: vi.fn(() => ({
      getSpreadsheet: vi.fn(async () => ({
        spreadsheetId: "sheet-verified",
        sheets: [
          "설정",
          "학생명단",
          "세션기록",
          "학생요약",
          "공식평가요약",
          "오류로그",
          "수정로그"
        ].map((title, index) => ({
          properties: {
            sheetId: index + 1,
            title
          }
        }))
      })),
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'설정'!A1:C20") {
          return [
            ["항목", "값", "설명"],
            ["시트 템플릿 버전", "v0.1-prototype", "프로토타입 예시"]
          ];
        }

        const tabName = range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";
        const headers: Record<string, string[]> = {
          설정: ["항목", "값", "설명", "", "사용 탭", "역할"],
          학생명단: ["학생ID", "학년도", "학년", "반", "번호", "이름", "성별", "활성", "비고"],
          세션기록: [
            "기록ID",
            "세션ID",
            "세션명",
            "학년도",
            "측정일",
            "세션유형",
            "입력화면유형",
            "대상반표시",
            "실제반",
            "종목",
            "단위",
            "학생ID",
            "학생이름",
            "시도순번",
            "원측정값",
            "대표값선택",
            "대표값선정교사",
            "공식등급",
            "제출시각",
            "동기화상태",
            "비고"
          ],
          학생요약: [
            "학생ID",
            "이름",
            "학년",
            "반",
            "종목",
            "최신대표값",
            "단위",
            "직전대표값",
            "변화량",
            "최고대표값",
            "최근측정일",
            "학생표시문구"
          ],
          공식평가요약: ["학생ID", "이름", "학년", "반", "종목", "대표값", "단위", "공식등급", "측정일", "세션명", "비고"],
          오류로그: ["시간", "수준", "구분", "메시지", "관련ID", "재시도상태", "해결시각"],
          수정로그: ["시간", "교사계정", "세션ID", "학생ID", "종목", "작업", "이전기록ID", "선택기록ID", "사유"]
        };

        return [headers[tabName] ?? []];
      }),
      appendRows: vi.fn(async () => ({})),
      updateRange: vi.fn(async () => ({}))
    }))
  };
});

const createTempStorePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "paps-teacher-settings-")), "demo-store.json");

const buildSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "Demo Elementary",
      teacherIds: ["demo-teacher"],
      sheetUrl: null,
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "demo-class-5-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    }
  ],
  teachers: [
    {
      id: "demo-teacher",
      schoolId: "demo-school",
      name: "Demo Teacher",
      email: "demo-teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe("teacher settings management", () => {
  let storePath = "";

  beforeEach(() => {
    vi.resetModules();
    storePath = createTempStorePath();
    process.env.PAPS_STORE_PATH = storePath;
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nmock-key\n-----END PRIVATE KEY-----\n";
    createDemoStore({
      filePath: storePath,
      seedData: buildSeed()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAPS_STORE_PATH;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("updates school info and adds a class from the settings management UI", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const schoolsRoute = await import("../../app/api/schools/route");
    const classesRoute = await import("../../app/api/classes/route");
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/schools" && method === "POST") {
          return schoolsRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/google-sheet/connect" && method === "POST") {
          return connectRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/classes" && method === "POST") {
          return classesRoute.POST(jsonRequest(pathname, method, body));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    const store = createDemoStore({ filePath: storePath });
    const school = store.getSchool("demo-school");
    const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager school={school} classes={classes} />
      </AppShell>
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "Updated Elementary" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-verified/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");

    fireEvent.change(screen.getByLabelText("새 학급 학년"), {
      target: { value: "6" }
    });
    fireEvent.change(screen.getByLabelText("새 학급 반 번호"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("새 학급 이름"), {
      target: { value: "6-2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학급 추가" }));

    await screen.findByText("학급을 추가했습니다.");

    await waitFor(() => {
      const reloadedStore = createDemoStore({ filePath: storePath });

      expect(reloadedStore.getSchool("demo-school").name).toBe("Updated Elementary");
      expect(reloadedStore.getSchool("demo-school").sheetUrl).toBe(
        "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      );
      expect(reloadedStore.listClasses().some((entry) => entry.label === "6-2")).toBe(true);
    });

    expect(screen.getByText("6-2")).toBeInTheDocument();
  });

  it("rejects connect requests when the service account is not shared on the sheet", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce({
      getSpreadsheet: vi.fn(async () => {
        throw new GoogleSheetsAccessError("sheet-unshared", 403);
      }),
      readRange: vi.fn(async () => []),
      appendRows: vi.fn(async () => ({})),
      updateRange: vi.fn(async () => ({}))
    });

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-unshared/edit",
        schoolName: "Blocked School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("cannot access spreadsheet sheet-unshared");
  });

  it("rejects connect requests when persisted teacher membership belongs to another email", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce({
      getSpreadsheet: vi.fn(async () => ({
        spreadsheetId: "sheet-owned",
        sheets: [
          "설정",
          "학생명단",
          "세션기록",
          "학생요약",
          "공식평가요약",
          "오류로그",
          "수정로그"
        ].map((title, index) => ({
          properties: {
            sheetId: index + 1,
            title
          }
        }))
      })),
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'설정'!A1:C20") {
          return [
            ["항목", "값", "설명"],
            ["시트 템플릿 버전", "v0.1-prototype", "프로토타입 예시"]
          ];
        }

        const tabName = range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";
        const headers: Record<string, string[]> = {
          설정: ["항목", "값", "설명", "", "사용 탭", "역할"],
          학생명단: ["학생ID", "학년도", "학년", "반", "번호", "이름", "성별", "활성", "비고"],
          세션기록: [
            "기록ID",
            "세션ID",
            "세션명",
            "학년도",
            "측정일",
            "세션유형",
            "입력화면유형",
            "대상반표시",
            "실제반",
            "종목",
            "단위",
            "학생ID",
            "학생이름",
            "시도순번",
            "원측정값",
            "대표값선택",
            "대표값선정교사",
            "공식등급",
            "제출시각",
            "동기화상태",
            "비고"
          ],
          학생요약: [
            "학생ID",
            "이름",
            "학년",
            "반",
            "종목",
            "최신대표값",
            "단위",
            "직전대표값",
            "변화량",
            "최고대표값",
            "최근측정일",
            "학생표시문구"
          ],
          공식평가요약: ["학생ID", "이름", "학년", "반", "종목", "대표값", "단위", "공식등급", "측정일", "세션명", "비고"],
          오류로그: ["시간", "수준", "구분", "메시지", "관련ID", "재시도상태", "해결시각"],
          수정로그: ["시간", "교사계정", "세션ID", "학생ID", "종목", "작업", "이전기록ID", "선택기록ID", "사유"]
        };

        if (range.endsWith("!A1:Z1")) {
          return [headers[tabName] ?? []];
        }

        if (range === "'설정'!A2:F200") {
          return [
            ["학교명", "Locked School", "교사가 관리 페이지에서 설정", "", "", ""],
            ["__PAPS_SCHOOL", "locked-school", "Locked School", "https://docs.google.com/spreadsheets/d/sheet-owned/edit", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
            ["__PAPS_TEACHER", "teacher-other", "locked-school", "Other Teacher", "other-teacher@example.com", ""],
            ["__PAPS_TEACHER_META", "teacher-other", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z", "", ""]
          ];
        }

        return [];
      }),
      appendRows: vi.fn(async () => ({})),
      updateRange: vi.fn(async () => ({}))
    });

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "Locked School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("The current teacher is not authorized for this spreadsheet.");
  });

  it("fails clearly when connect is attempted without service-account env", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
        schoolName: "Missing Env School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Google Sheets service account environment variables are missing.");
  });

  it("fails clearly when validate is attempted without service-account env", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const validateRoute = await import("../../app/api/google-sheet/validate/route");
    const response = await validateRoute.POST(
      jsonRequest("/api/google-sheet/validate", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Google Sheets service account environment variables are missing.");
  });
});
