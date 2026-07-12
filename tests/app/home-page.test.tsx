import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);

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

describe("home page", () => {
  it("describes the finished PAPS workflow without MVP staging copy", async () => {
    const { default: HomePage } = await import("../../app/page");

    render(<HomePage />);

    expect(screen.getByText("PAPS Tracker")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /학생 기록은 빠르게,\s+PAPS 운영은 한 흐름으로\./
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /교사는 학교·학급·학생 명단을 준비하고 세션을 열어 기록 입력부터 대표값 검토, Google Sheets 동기화까지 관리할 수 있습니다\./
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/PAPS Tracker MVP/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready For Next Tasks/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/다음 단계에서는/)).not.toBeInTheDocument();
  });

  it("uses teacher home as the only actionable entry point", async () => {
    const { default: HomePage } = await import("../../app/page");

    render(<HomePage />);

    expect(screen.getByRole("link", { name: /교사 홈으로 시작/ })).toHaveAttribute(
      "href",
      "/teacher"
    );
    expect(screen.queryByRole("link", { name: /학생 입력 영역/ })).not.toBeInTheDocument();
    expect(
      screen.getByText(/학생은 선생님이 열어 준 세션 링크 또는 QR 코드로 접속합니다\./)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/학생 입력 링크는 교사 홈에서 세션을 연 뒤 안내할 수 있습니다\./)
    ).toBeInTheDocument();

    const links = screen.getAllByRole("link") as HTMLAnchorElement[];
    expect(links.some((link) => link.getAttribute("href")?.startsWith("/session"))).toBe(false);
  });

  it("opens update history from the landing page", async () => {
    const { default: HomePage } = await import("../../app/page");

    render(<HomePage />);

    expect(screen.getByText("v1.1.1")).toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: /Update info/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", {
      name: /업데이트 기록/
    });

    expect(dialog).toBeInTheDocument();
    const closeButton = screen.getByRole("button", { name: "닫기" });
    expect(closeButton).toHaveFocus();

    fireEvent.keyDown(closeButton, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    expect(screen.getAllByText("v1.1.1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/보안과 운영 기반 강화/)).toBeInTheDocument();
    expect(screen.getAllByText("2026-07-12").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("2026-03-24")).toBeInTheDocument();
    expect(screen.getByText(/악력 좌우 기록/)).toBeInTheDocument();
    expect(screen.getByText(/설정 저장 후 즉시 최신화/)).toBeInTheDocument();
    expect(screen.getByText(/즉시 결과 기록 순서 보정/)).toBeInTheDocument();
    expect(screen.getByText(/완제품 운영 흐름/)).toBeInTheDocument();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "초기 MVP" })).toBeInTheDocument();

    fireEvent.keyDown(closeButton, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /업데이트 기록/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
