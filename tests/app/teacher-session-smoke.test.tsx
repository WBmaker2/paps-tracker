import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PAPSDemoStoreData } from "../../src/lib/paps/types";
import { resetRequestStore, getRequestStore } from "../../src/lib/store/paps-memory-store";

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
  students: [
    {
      id: "student-kim",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    }
  ],
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

describe("teacher session smoke flow", () => {
  beforeEach(() => {
    resetRequestStore(buildSeed());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRequestStore();
  });

  it("gives a small end-to-end-ish smoke check for teacher session creation flow", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const sessionRoute = await import("../../app/api/sessions/[sessionId]/route");
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSessionWorkspace } = await import("../../src/components/teacher/session-form");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/sessions" && method === "POST") {
          return sessionsRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname.startsWith("/api/sessions/") && method === "PATCH") {
          const sessionId = pathname.split("/").pop() ?? "";

          return sessionRoute.PATCH(jsonRequest(pathname, method, body), {
            params: Promise.resolve({ sessionId })
          });
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    const sessionsBefore = getRequestStore().listSessions();

    render(
      <AppShell
        title="교사 대시보드"
        eyebrow="Teacher"
        description="세션 생성과 상태 제어를 한 번에 점검합니다."
      >
        <div>
          <p>현재 세션 수: {sessionsBefore.length}</p>
          <TeacherSessionWorkspace
            classes={getRequestStore().listClasses()}
            sessions={sessionsBefore}
            defaultTeacherId="demo-teacher"
            defaultSchoolId="demo-school"
          />
        </div>
      </AppShell>
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5-1 Official Sit And Reach" }
    });
    fireEvent.change(screen.getByLabelText("세션 유형"), {
      target: { value: "official" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "single" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("세션을 저장했습니다.");
    expect((await screen.findAllByText("5-1 Official Sit And Reach")).length).toBeGreaterThan(0);

    const createdSession = getRequestStore()
      .listSessions()
      .find((session) => session.name === "5-1 Official Sit And Reach");

    expect(createdSession).toBeDefined();
    expect(createdSession?.isOpen).toBe(true);

    const patchResponse = await sessionRoute.PATCH(
      jsonRequest(`/api/sessions/${createdSession?.id}`, "PATCH", {
        isOpen: false
      }),
      {
        params: Promise.resolve({ sessionId: createdSession?.id ?? "" })
      }
    );

    expect(patchResponse.status).toBe(200);

    await waitFor(() => {
      expect(getRequestStore().getSession(createdSession?.id ?? "").isOpen).toBe(false);
    });
  });

  it("filters event choices by grade so grade 4 and grade 5+ follow the manual", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSessionWorkspace } = await import("../../src/components/teacher/session-form");

    render(
      <AppShell
        title="교사 대시보드"
        eyebrow="Teacher"
        description="학년별 종목 선택을 점검합니다."
      >
        <TeacherSessionWorkspace
          classes={getRequestStore().listClasses()}
          sessions={[]}
          defaultTeacherId="demo-teacher"
          defaultSchoolId="demo-school"
        />
      </AppShell>
    );

    fireEvent.change(screen.getByLabelText("학년"), {
      target: { value: "4" }
    });

    const eventSelect = screen.getByLabelText("주 종목");
    const grade4Options = Array.from(eventSelect.querySelectorAll("option")).map(
      (option) => option.textContent
    );

    expect(grade4Options).toContain("왕복오래달리기");
    expect(grade4Options).toContain("윗몸말아올리기");
    expect(grade4Options).toContain("악력");
    expect(grade4Options).toContain("50m달리기");
    expect(grade4Options).toContain("제자리멀리뛰기");
    expect(grade4Options).not.toContain("앉아윗몸앞으로굽히기");
    expect(grade4Options).not.toContain("오래달리기-걷기");

    fireEvent.change(screen.getByLabelText("학년"), {
      target: { value: "5" }
    });

    const grade5Options = Array.from(eventSelect.querySelectorAll("option")).map(
      (option) => option.textContent
    );

    expect(grade5Options).toContain("앉아윗몸앞으로굽히기");
    expect(grade5Options).toContain("오래달리기-걷기");
    expect(grade5Options).toContain("윗몸말아올리기");
  });
});
