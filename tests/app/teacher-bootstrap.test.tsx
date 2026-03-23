import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

vi.mock("../../src/lib/store/paps-store", () => ({
  createStoreForRequest
}));

describe("teacher bootstrap contract", () => {
  it("routes teacher bootstrap loading through createStoreForRequest", async () => {
    const { default: TeacherDashboardPage } = await import("../../app/teacher/page");

    render(await TeacherDashboardPage());

    expect(createStoreForRequest).toHaveBeenCalled();
  });
});
