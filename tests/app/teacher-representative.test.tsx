import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStore } from "../../src/lib/demo-store";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

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
  getTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
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

const createTempStorePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "paps-teacher-ui-")), "demo-store.json");

const buildTeacherSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "Demo Elementary",
      teacherIds: ["demo-teacher"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/demo-sheet/edit",
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
    },
    {
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
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
    },
    {
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-2",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "session-official-1",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:10:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "session-official-1",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T09:20:00.000Z"
    },
    {
      id: "attempt-2",
      sessionId: "session-official-1",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 22,
      createdAt: "2026-03-23T09:22:00.000Z"
    }
  ],
  syncStatuses: [
    {
      id: "session-official-1:student-kim",
      sessionId: "session-official-1",
      studentId: "student-kim",
      status: "failed",
      attemptId: "attempt-2",
      updatedAt: "2026-03-23T09:25:00.000Z"
    }
  ],
  syncErrorLogs: [
    {
      id: "sync-error:session-official-1:student-kim:2026-03-23T09:25:00.000Z",
      sessionId: "session-official-1",
      studentId: "student-kim",
      syncStatusId: "session-official-1:student-kim",
      message: "Google Sheets API unavailable",
      createdAt: "2026-03-23T09:25:00.000Z"
    }
  ],
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

const installTeacherApiFetch = async () => {
  const sessionsRoute = await import("../../app/api/sessions/route");
  const representativeRoute = await import("../../app/api/records/[recordId]/representative/route");

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

      if (pathname.startsWith("/api/records/") && method === "PATCH") {
        const recordId = pathname.split("/")[3] ?? "";

        return representativeRoute.PATCH(jsonRequest(pathname, method, body), {
          params: Promise.resolve({ recordId })
        });
      }

      throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
    })
  );
};

describe("teacher representative and session flows", () => {
  let storePath = "";

  beforeEach(() => {
    vi.resetModules();
    storePath = createTempStorePath();
    process.env.PAPS_STORE_PATH = storePath;
    createDemoStore({
      filePath: storePath,
      seedData: buildTeacherSeed()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PAPS_STORE_PATH;
  });

  it("creates a one-class or two-class session from the teacher dashboard", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");

    render(
      <SessionForm
        classes={createDemoStore({ filePath: storePath }).listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5-1 Shuttle Run Practice" }
    });
    fireEvent.change(screen.getByLabelText("학년"), {
      target: { value: "5" }
    });
    fireEvent.change(screen.getByLabelText("세션 유형"), {
      target: { value: "practice" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "single" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "shuttle-run" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("세션을 저장했습니다.");

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5학년 Sit And Reach Split" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "split" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.change(screen.getByLabelText("보조 반"), {
      target: { value: "demo-class-5-2" }
    });
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.change(screen.getByLabelText("보조 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await waitFor(() => {
      expect(createDemoStore({ filePath: storePath }).listSessions()).toHaveLength(3);
    });

    expect(
      createDemoStore({ filePath: storePath }).listSessions().map((session) => session.classScope)
    ).toEqual(["single", "single", "split"]);
  });

  it("blocks a two-class session when the selected classes do not share the same event", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");

    render(
      <SessionForm
        classes={createDemoStore({ filePath: storePath }).listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "잘못된 분할 세션" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "split" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.change(screen.getByLabelText("보조 반"), {
      target: { value: "demo-class-5-2" }
    });
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.change(screen.getByLabelText("보조 종목"), {
      target: { value: "shuttle-run" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("Split sessions must use the same event for both classes.");

    expect(createDemoStore({ filePath: storePath }).listSessions()).toHaveLength(1);
  });

  it("lets a teacher choose the representative attempt", async () => {
    await installTeacherApiFetch();
    const { ResultTable } = await import("../../src/components/teacher/result-table");

    render(
      <ResultTable
        rows={[
          {
            recordId: "session-official-1:student-kim",
            sessionId: "session-official-1",
            studentId: "student-kim",
            studentName: "Kim",
            classLabel: "5-1",
            sessionName: "5-1 Sit And Reach",
            eventLabel: "앉아윗몸앞으로굽히기",
            unit: "cm",
            representativeAttemptId: null,
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                measurement: 18,
                createdAt: "2026-03-23T09:20:00.000Z"
              },
              {
                id: "attempt-2",
                attemptNumber: 2,
                measurement: 22,
                createdAt: "2026-03-23T09:22:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "2회차 대표값으로 선택" }));

    await screen.findByText("대표값이 업데이트되었습니다.");

    expect(
      createDemoStore({ filePath: storePath }).getAttemptRecord({
        sessionId: "session-official-1",
        studentId: "student-kim"
      }).representativeAttemptId
    ).toBe("attempt-2");
  });

  it("shows sync failure status with a resync action", async () => {
    await installTeacherApiFetch();
    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");

    render(
      <SyncStatusCard
        recordId="session-official-1:student-kim"
        status="failed"
        updatedAt="2026-03-23T09:25:00.000Z"
        message="Google Sheets API unavailable"
      />
    );

    expect(screen.getByText("Google Sheets API unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "재동기화 요청" }));

    await screen.findByText("재동기화를 다시 대기열에 넣었습니다.");

    const updatedAt = createDemoStore({ filePath: storePath }).getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.updatedAt;

    expect(
      createDemoStore({ filePath: storePath }).getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.status
    ).toBe("pending");
    expect(updatedAt).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(`마지막 업데이트: ${updatedAt}`)).toBeInTheDocument();
    });
  });
});
