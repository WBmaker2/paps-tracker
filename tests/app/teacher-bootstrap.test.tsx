import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const bootstrap = {
  teacher: null,
  school: null,
  schools: [],
  classes: [],
  teachers: [],
  students: [],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
};

const cookies = vi.fn(async () => ({
  get: () => undefined
}));
const refresh = vi.fn();

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

vi.mock("next/headers", () => ({
  cookies
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  }))
}));

const createStoreForRequest = vi.fn(async () => ({
  getTeacherBootstrap: vi.fn(async () => bootstrap)
}));

const loadTeacherPageState = vi.fn(async ({ teacherEmail }: { teacherEmail: string }) => {
  if (process.env.NODE_ENV === "production") {
    return {
      store: null,
      bootstrap,
      sheetConnected: false,
      sheetStatus: {
        code: "not_connected",
        isConnected: false,
        canReconnect: true,
        summary: "구글 시트가 아직 연결되지 않았습니다.",
        detail: "설정 화면에서 템플릿 사본을 만들고 시트 URL을 저장해 주세요."
      }
    };
  }

  const store = await createStoreForRequest();

  return {
    store,
    bootstrap: await store.getTeacherBootstrap({ teacherEmail }),
    sheetConnected: true,
    sheetStatus: {
      code: "connected",
      isConnected: true,
      canReconnect: false,
      summary: "구글 시트가 연결되었습니다.",
      detail: null
    }
  };
});

vi.mock("../../src/lib/store/paps-store", () => ({
  createStoreForRequest
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState
}));

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  TeacherDataRefresh: () => null,
  notifyTeacherDataRefresh: vi.fn()
}));

describe("teacher bootstrap contract", () => {
  afterEach(() => {
    cookies.mockReset();
    createStoreForRequest.mockClear();
    loadTeacherPageState.mockClear();
    refresh.mockReset();
    process.env.NODE_ENV = "test";
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;
  });

  it("routes teacher bootstrap loading through createStoreForRequest", async () => {
    const { default: TeacherDashboardPage } = await import("../../app/teacher/page");

    render(await TeacherDashboardPage());

    expect(createStoreForRequest).toHaveBeenCalled();
    const store = await createStoreForRequest.mock.results[0]!.value;
    expect(store?.getTeacherBootstrap).toHaveBeenCalledWith({
      teacherEmail: "demo-teacher@example.com"
    });
  });

  it("falls back to the disconnected setup prompt when a spreadsheet cookie is stale", async () => {
    process.env.NODE_ENV = "production";
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    cookies.mockResolvedValue({
      get: () => ({
        value: "stale-sheet"
      })
    });

    const { default: TeacherSettingsPage } = await import("../../app/teacher/settings/page");

    render(await TeacherSettingsPage());

    expect(loadTeacherPageState).toHaveBeenCalledWith({
      teacherEmail: "demo-teacher@example.com",
      spreadsheetId: "stale-sheet"
    });
    expect(screen.getByText("구글 시트 최초 연결 안내")).toBeInTheDocument();
    expect(screen.getByText("배포 설정 확인 필요")).toBeInTheDocument();
  });

  it("shows an operational readiness summary on the settings page", async () => {
    process.env.NODE_ENV = "production";
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nmock-key\\n-----END PRIVATE KEY-----\\n";
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_HOSTED_DOMAIN = "school.kr";

    const { default: TeacherSettingsPage } = await import("../../app/teacher/settings/page");

    render(await TeacherSettingsPage());

    expect(screen.getByRole("heading", { name: "운영 준비 상태" })).toBeInTheDocument();
    expect(screen.getByText("교사 로그인")).toBeInTheDocument();
    expect(screen.getByText("school.kr 도메인")).toBeInTheDocument();
    expect(screen.getByText("Google Sheets 연동")).toBeInTheDocument();
    expect(screen.getByText("서비스 계정 및 템플릿 준비 완료")).toBeInTheDocument();
  });
});
