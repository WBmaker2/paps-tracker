import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PAPSDemoStoreData } from "../../src/lib/paps/types";
import { GoogleSheetsAccessError } from "../../src/lib/google/sheets-client";

const notifyTeacherDataRefresh = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
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

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  buildTeacherMutationHeaders: (headers?: HeadersInit) => new Headers(headers),
  notifyTeacherDataRefresh
}));

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

const importRequestStore = () => import("../../src/lib/store/paps-memory-store");

const prototypeHeaders: Record<string, string[]> = {
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

const createLockedSheetClient = (updateRange = vi.fn(async () => ({}))) => ({
  getSpreadsheet: vi.fn(async () => ({
    spreadsheetId: "sheet-owned",
    sheets: Object.keys(prototypeHeaders).map((title, index) => ({
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

    if (range.endsWith("!A1:Z1")) {
      const tabName = range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";

      return [prototypeHeaders[tabName] ?? []];
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
  updateRange
});

describe("teacher settings management", () => {
  beforeEach(async () => {
    vi.resetModules();
    notifyTeacherDataRefresh.mockReset();
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nmock-key\n-----END PRIVATE KEY-----\n";
    const { resetRequestStore } = await importRequestStore();
    resetRequestStore(buildSeed());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("updates school info and adds a class from the settings management UI", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const templateRoute = await import("../../app/api/google-sheet/template/route");
    const schoolsRoute = await import("../../app/api/schools/route");
    const classesRoute = await import("../../app/api/classes/route");
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const openSpy = vi.fn();

    vi.stubGlobal("open", openSpy);
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

        if (pathname === "/api/google-sheet/template" && method === "POST") {
          return templateRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/classes" && method === "POST") {
          return classesRoute.POST(jsonRequest(pathname, method, body));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    const { getRequestStore } = await importRequestStore();
    const store = getRequestStore();
    const school = store.getSchool("demo-school");
    const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={school}
          classes={classes}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: true,
            serviceAccountEmail: "service-account@example.com",
            missingKeys: []
          }}
        />
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "구글 시트 생성(최초 1회)" }));

    await screen.findByText(/새 탭에서 템플릿 복사 화면을 열었습니다/);

    expect(openSpy).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/template-sheet-id/copy",
      "_blank",
      "noopener,noreferrer"
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "Updated Elementary" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-verified/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");
    expect(notifyTeacherDataRefresh).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("새 학급 학년"), {
      target: { value: "6" }
    });
    fireEvent.change(screen.getByLabelText("반(숫자입력)"), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학급 추가" }));

    await screen.findByText("학급을 추가했습니다.");
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: expect.any(String)
    });

    await waitFor(() => {
      const reloadedStore = store;

      expect(reloadedStore.getSchool("demo-school").name).toBe("Updated Elementary");
      expect(reloadedStore.getSchool("demo-school").sheetUrl).toBe(
        "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      );
      expect(reloadedStore.listClasses().some((entry) => entry.label === "6-2")).toBe(true);
    });

    expect(screen.getByText("6-2")).toBeInTheDocument();
    expect(screen.queryByLabelText("새 학급 이름")).not.toBeInTheDocument();
  });

  it("sets a durable spreadsheet cookie when school information is saved", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
        schoolName: "Durable Cookie School"
      })
    );
    const setCookieHeader = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookieHeader).toContain("paps-spreadsheet-id=sheet-verified");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("SameSite=lax");
    expect(setCookieHeader).toContain("Path=/");
    expect(setCookieHeader).toContain("Max-Age=31536000");
  });

  it("sets and clears the teacher return PIN from the settings screen", async () => {
    const pinRoute = await import("../../app/api/teacher/student-return-pin/route");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const { getRequestStore } = await importRequestStore();
    const store = getRequestStore();
    const school = store.getSchool("demo-school");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/teacher/student-return-pin" && method === "POST") {
          return pinRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/teacher/student-return-pin" && method === "DELETE") {
          return pinRoute.DELETE(jsonRequest(pathname, method));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    render(
      <TeacherSettingsManager
        school={school}
        classes={[]}
        sheetSetupStatus={{
          templateConfigured: true,
          serviceAccountConfigured: true,
          serviceAccountEmail: "service-account@example.com",
          missingKeys: []
        }}
      />
    );

    expect(screen.getByText("PIN 미설정")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("새 PIN"), {
      target: { value: "2468" }
    });
    fireEvent.change(screen.getByLabelText("새 PIN 확인"), {
      target: { value: "2468" }
    });
    fireEvent.click(screen.getByRole("button", { name: "PIN 저장" }));

    await screen.findByText("교사 화면 접근 PIN을 저장했습니다.");

    expect(screen.getByText("PIN 설정됨")).toBeInTheDocument();
    expect(store.getSchool("demo-school").teacherReturnPin?.hash).not.toContain("2468");
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: expect.any(String)
    });

    fireEvent.click(screen.getByRole("button", { name: "PIN 해제" }));

    await screen.findByText("교사 화면 접근 PIN을 해제했습니다.");
    expect(screen.getByText("PIN 미설정")).toBeInTheDocument();
    expect(store.getSchool("demo-school").teacherReturnPin).toBeNull();
  });

  it("restores the last saved school info after the settings form remounts", async () => {
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const fetchMock = vi.fn(async () =>
      Response.json({
        school: {
          id: "demo-school",
          name: "도촌초등학교",
          teacherIds: ["demo-teacher"],
          sheetUrl:
            "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-04-15T09:00:00.000Z"
        },
        normalizedUrl:
          "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const renderManager = () =>
      render(
        <TeacherSettingsManager
          school={null}
          classes={[]}
          sheetConnected={false}
          sheetStatus={{
            code: "not_connected",
            isConnected: false,
            canReconnect: true,
            summary: "연결된 구글 시트가 없습니다.",
            detail: null
          }}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: true,
            serviceAccountEmail: "service-account@example.com",
            missingKeys: []
          }}
        />
      );

    const firstRender = renderManager();

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "도촌초등학교" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: {
        value:
          "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");

    firstRender.unmount();
    renderManager();

    expect((screen.getByLabelText("학교명") as HTMLInputElement).value).toBe("도촌초등학교");
    expect((screen.getByLabelText("구글 시트 URL") as HTMLInputElement).value).toBe(
      "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
    );
  });

  it("shows setup guidance and missing env warning when service account config is incomplete", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={null}
          classes={[]}
          sheetConnected={false}
          sheetStatus={{
            code: "missing_service_account",
            isConnected: false,
            canReconnect: false,
            summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다.",
            detail: "설정 화면의 환경변수 경고를 확인한 뒤 다시 시도해 주세요."
          }}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: false,
            serviceAccountEmail: null,
            missingKeys: [
              "GOOGLE_SERVICE_ACCOUNT_EMAIL",
              "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
            ]
          }}
        />
      </AppShell>
    );

    expect(screen.getByText("구글 시트 연결 안내")).toBeInTheDocument();
    expect(screen.getByText("1단계. 템플릿 시트 복사본 만들기")).toBeInTheDocument();
    expect(screen.getByText("2단계. 서비스 계정과 시트 공유")).toBeInTheDocument();
    expect(screen.getByText("3단계. 복사한 시트 URL 붙여넣기")).toBeInTheDocument();
    expect(screen.getByText("4단계. 연결 확인 후 저장")).toBeInTheDocument();
    expect(screen.getByText("배포 설정 확인 필요")).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_SERVICE_ACCOUNT_EMAIL/)).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY/)).toBeInTheDocument();
  });

  it("shows the current spreadsheet issue separately from first-time setup guidance", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={null}
          classes={[]}
          sheetConnected={false}
          sheetStatus={{
            code: "access_denied",
            isConnected: false,
            canReconnect: true,
            summary: "서비스 계정이 현재 구글 시트에 접근할 수 없습니다.",
            detail: "복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요."
          }}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: true,
            serviceAccountEmail: "service-account@example.com",
            missingKeys: []
          }}
        />
      </AppShell>
    );

    expect(screen.getByText("현재 연결 문제")).toBeInTheDocument();
    expect(
      screen.getByText("서비스 계정이 현재 구글 시트에 접근할 수 없습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요.")
    ).toHaveLength(2);
  });

  it("offers an explicit existing-sheet import flow when the current teacher is missing from the sheet", async () => {
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const requestBodies: unknown[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {};

      requestBodies.push(body);

      if (body.mode === "claim_existing_sheet") {
        return Response.json({
          ok: true,
          school: {
            id: "locked-school",
            name: "도촌초등학교",
            teacherIds: ["teacher-other", "teacher-demo-teacher-example-com"],
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
            createdAt: "2026-03-24T09:00:00.000Z",
            updatedAt: "2026-04-21T09:00:00.000Z"
          },
          normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-owned/edit"
        });
      }

      return Response.json(
        {
          ok: false,
          code: "teacher_not_authorized",
          action: "claim_existing_sheet",
          error: "The current teacher is not authorized for this spreadsheet."
        },
        { status: 409 }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeacherSettingsManager
        school={null}
        classes={[]}
        sheetConnected={false}
        sheetStatus={{
          code: "teacher_not_authorized",
          isConnected: false,
          canReconnect: true,
          summary: "현재 로그인한 교사가 이 시트의 담당교사 목록에 없습니다.",
          detail: "기존 시트를 가져오면 현재 교사를 담당교사로 추가할 수 있습니다."
        }}
        sheetSetupStatus={{
          templateConfigured: true,
          serviceAccountConfigured: true,
          serviceAccountEmail: "service-account@example.com",
          missingKeys: []
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "도촌초등학교" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-owned/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("기존 PAPS 시트 가져오기");
    await waitFor(() => expect(requestBodies).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "기존 시트 가져오기" }));

    await screen.findByText("기존 시트를 가져오고 현재 교사를 담당교사로 추가했습니다.");
    expect(requestBodies).toEqual([
      {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "도촌초등학교"
      },
      {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "도촌초등학교",
        mode: "claim_existing_sheet"
      }
    ]);
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

    expect(response.status).toBe(409);
    expect(payload.code).toBe("teacher_not_authorized");
    expect(payload.action).toBe("claim_existing_sheet");
    expect(payload.error).toBe("The current teacher is not authorized for this spreadsheet.");
  });

  it("claims an existing sheet by adding the current teacher when explicitly requested", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");
    const updateRange = vi.fn(async () => ({}));

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce(
      createLockedSheetClient(updateRange)
    );

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "Locked School",
        mode: "claim_existing_sheet"
      })
    );
    const payload = await response.json();
    const settingsUpdate = updateRange.mock.calls.find(
      ([, range]) => range === "'설정'!A1:F200"
    );
    const settingsRows = settingsUpdate?.[2] as string[][] | undefined;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(settingsRows).toEqual(
      expect.arrayContaining([
        [
          "__PAPS_TEACHER",
          "teacher-other",
          "locked-school",
          "Other Teacher",
          "other-teacher@example.com",
          ""
        ],
        [
          "__PAPS_TEACHER",
          "teacher-demo-teacher-example-com",
          "locked-school",
          "Demo Teacher",
          "demo-teacher@example.com",
          ""
        ]
      ])
    );
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

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      ok: false,
      status: "missing_service_account",
      spreadsheetId: "sheet-verified",
      templateVersion: null,
      summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다."
    });
  });
});
