import React from "react";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const cookies = vi.fn(async () => ({
  get: (name: string) =>
    name === "paps-spreadsheet-id" ? { value: "sheet-123" } : undefined
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

const loadStudentSessionViewFromSheet = vi.fn(async () => ({
  session: {
    id: "session-1",
    sessionType: "official",
    classScope: "single",
    eventId: "sit-and-reach",
    isOpen: true,
    classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }]
  },
  classSections: [
    {
      classId: "demo-class-5-1",
      label: "5-1",
      students: [{ id: "student-kim", name: "Kim" }]
    }
  ]
}));

const appendStudentSubmissionToSheet = vi.fn(async () => ({
  ok: false as const,
  error: "Append failed."
}));

vi.mock("../../src/lib/google/sheets-submit", () => ({
  loadStudentSessionViewFromSheet,
  appendStudentSubmissionToSheet
}));

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie: "paps-spreadsheet-id=sheet-123"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe("student sheet-backed submit flow", () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("returns 409 when the sheet append fails in production mode", async () => {
    process.env.NODE_ENV = "production";
    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-1/submit", "POST", {
        studentId: "student-kim",
        measurement: 24,
        clientSubmissionKey: "submit-1"
      }),
      {
        params: Promise.resolve({ sessionId: "session-1" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Append failed."
    });
    expect(appendStudentSubmissionToSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet-123",
        sessionId: "session-1",
        studentId: "student-kim",
        clientSubmissionKey: "submit-1"
      })
    );
  });

  it("loads the student session page from the sheet-backed runtime in production mode", async () => {
    process.env.NODE_ENV = "production";
    const pageModule = await import("../../app/session/[sessionId]/page");

    render(
      await pageModule.default({
        params: Promise.resolve({
          sessionId: "session-1"
        })
      })
    );

    expect(loadStudentSessionViewFromSheet).toHaveBeenCalledWith(
      expect.objectContaining({
        spreadsheetId: "sheet-123",
        sessionId: "session-1"
      })
    );
    expect(screen.getByRole("button", { name: "Kim" })).toBeInTheDocument();
  });
});
