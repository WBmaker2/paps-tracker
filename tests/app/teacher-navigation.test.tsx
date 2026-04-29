import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const redirectError = new Error("NEXT_REDIRECT");
const redirectMock = vi.fn(() => {
  throw redirectError;
});

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

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined
  }))
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  }))
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState: vi.fn(async () => ({
    bootstrap: {
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
    },
    sheetConnected: true,
    sheetStatus: {
      code: "connected",
      isConnected: true,
      canReconnect: false,
      summary: "구글 시트가 연결되었습니다.",
      detail: null
    }
  }))
}));

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  TeacherDataRefresh: () => null,
  notifyTeacherDataRefresh: vi.fn()
}));

describe("teacher navigation", () => {
  it("uses one teacher home entry instead of separate dashboard and session entries", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");

    render(
      <AppShell eyebrow="Teacher" title="교사 홈" description="통합 교사 작업 화면입니다.">
        <p>teacher content</p>
      </AppShell>
    );

    expect(screen.getByRole("link", { name: "교사 홈" })).toHaveAttribute("href", "/teacher");
    expect(screen.queryByRole("link", { name: "대시보드" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "세션" })).not.toBeInTheDocument();
  });

  it("redirects the old session management route to teacher home", async () => {
    const { default: TeacherSessionsPage } = await import("../../app/teacher/sessions/page");

    await expect(async () => {
      await TeacherSessionsPage();
    }).rejects.toThrow("NEXT_REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/teacher");
  });
});
