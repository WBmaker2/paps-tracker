import React from "react";
import { render, screen } from "@testing-library/react";
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
});
