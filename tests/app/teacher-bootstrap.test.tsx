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

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/headers", () => ({
  cookies
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
      sheetConnected: false
    };
  }

  const store = await createStoreForRequest();

  return {
    store,
    bootstrap: await store.getTeacherBootstrap({ teacherEmail }),
    sheetConnected: true
  };
});

vi.mock("../../src/lib/store/paps-store", () => ({
  createStoreForRequest
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState
}));

describe("teacher bootstrap contract", () => {
  afterEach(() => {
    cookies.mockReset();
    createStoreForRequest.mockClear();
    loadTeacherPageState.mockClear();
    process.env.NODE_ENV = "test";
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
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
    expect(screen.getByText("구글 시트 연결 안내")).toBeInTheDocument();
    expect(screen.getByText("배포 설정 확인 필요")).toBeInTheDocument();
  });
});
