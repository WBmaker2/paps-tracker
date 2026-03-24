import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PAPSDemoStoreData } from "../../src/lib/paps/types";
import { getRequestStore, resetRequestStore } from "../../src/lib/store/paps-memory-store";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

const buildStudentSeed = (): PAPSDemoStoreData => ({
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
      id: "student-park",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 2,
      name: "Park",
      sex: "male",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-2",
      studentNumber: 1,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "session-open-single",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Official Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:10:00.000Z"
    },
    {
      id: "session-open-split",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5th Grade Shuttle Run",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "split",
      eventId: "shuttle-run",
      classTargets: [
        { classId: "demo-class-5-1", eventId: "shuttle-run" },
        { classId: "demo-class-5-2", eventId: "shuttle-run" }
      ],
      isOpen: true,
      createdAt: "2026-03-23T09:20:00.000Z"
    },
    {
      id: "session-closed",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "Closed Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: false,
      createdAt: "2026-03-23T09:30:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "session-open-single",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T09:40:00.000Z"
    },
    {
      id: "attempt-2",
      sessionId: "session-open-single",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 21,
      createdAt: "2026-03-23T09:42:00.000Z"
    }
  ],
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

const renderStudentSessionPage = async (sessionId: string) => {
  const pageModule = await import("../../app/session/[sessionId]/page");

  render(
    await pageModule.default({
      params: Promise.resolve({
        sessionId
      })
    })
  );
};

const installStudentApiFetch = async () => {
  const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const pathname = new URL(url, "http://localhost").pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

      if (pathname.startsWith("/api/sessions/") && pathname.endsWith("/submit") && method === "POST") {
        const sessionId = pathname.split("/")[3] ?? "";

        return submitRoute.POST(jsonRequest(pathname, method, body), {
          params: Promise.resolve({ sessionId })
        });
      }

      throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
    })
  );
};

describe("student session flow", () => {
  beforeEach(() => {
    resetRequestStore(buildStudentSeed());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock("../../src/lib/paps/grade");
    resetRequestStore();
  });

  it("shows only a name picker before input", async () => {
    await renderStudentSessionPage("session-open-single");

    expect(screen.getByText("이름을 선택하세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.queryByLabelText("앉아윗몸앞으로굽히기 기록")).not.toBeInTheDocument();
    expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
  });

  it("submits a new attempt for a one-class session", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "24" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");

    await waitFor(() => {
      expect(
        getRequestStore().getAttemptRecord({
          sessionId: "session-open-single",
          studentId: "student-kim"
        }).attempts
      ).toHaveLength(3);
    });

    expect(
      getRequestStore()
        .getAttemptRecord({
          sessionId: "session-open-single",
          studentId: "student-kim"
        })
        .attempts.at(-1)?.measurement
    ).toBe(24);
  });

  it("rejects an empty measurement in the form and submit API", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("숫자 기록을 입력해 주세요.");

    expect(
      getRequestStore().getAttemptRecord({
        sessionId: "session-open-single",
        studentId: "student-kim"
      }).attempts
    ).toHaveLength(2);

    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-open-single/submit", "POST", {
        studentId: "student-kim",
        measurement: ""
      }),
      {
        params: Promise.resolve({ sessionId: "session-open-single" })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "A numeric measurement is required."
    });
  });

  it("does not save an attempt when official grade computation fails", async () => {
    const gradeModule = await import("../../src/lib/paps/grade");
    vi.spyOn(gradeModule, "calculateOfficialGrade").mockImplementation(() => {
        throw new Error("Grade lookup failed.");
    });
    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-open-single/submit", "POST", {
        studentId: "student-kim",
        measurement: 24
      }),
      {
        params: Promise.resolve({ sessionId: "session-open-single" })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Grade lookup failed."
    });
    expect(
      getRequestStore().getAttemptRecord({
        sessionId: "session-open-single",
        studentId: "student-kim"
      }).attempts
    ).toHaveLength(2);
  });

  it("stamps attempts with a server-generated timestamp", async () => {
    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-open-single/submit", "POST", {
        studentId: "student-kim",
        measurement: 24,
        createdAt: "1999-01-01T00:00:00.000Z"
      }),
      {
        params: Promise.resolve({ sessionId: "session-open-single" })
      }
    );

    expect(response.status).toBe(201);
    expect(
      getRequestStore()
        .getAttemptRecord({
          sessionId: "session-open-single",
          studentId: "student-kim"
        })
        .attempts.at(-1)?.createdAt
    ).not.toBe("1999-01-01T00:00:00.000Z");
  });

  it("resets typed measurement and local errors when switching between students with the same name", async () => {
    getRequestStore().saveStudent({
      id: "student-kim-2",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 3,
      name: "Kim",
      sex: "male",
      gradeLevel: 5,
      active: true
    });

    await renderStudentSessionPage("session-open-single");

    const kimButtons = screen.getAllByRole("button", { name: "Kim" });

    fireEvent.click(kimButtons[0]!);
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));
    await screen.findByText("숫자 기록을 입력해 주세요.");

    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "17" }
    });
    fireEvent.click(kimButtons[1]!);

    expect(screen.queryByText("숫자 기록을 입력해 주세요.")).not.toBeInTheDocument();
    expect(
      (screen.getByLabelText("앉아윗몸앞으로굽히기 기록") as HTMLInputElement).value
    ).toBe("");
  });

  it("rejects inactive students on submit", async () => {
    getRequestStore().saveStudent({
      ...getRequestStore().getStudent("student-park"),
      active: false
    });

    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-open-single/submit", "POST", {
        studentId: "student-park",
        measurement: 19
      }),
      {
        params: Promise.resolve({ sessionId: "session-open-single" })
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Inactive students cannot submit attempts."
    });
    expect(
      getRequestStore().getAttemptRecord({
        sessionId: "session-open-single",
        studentId: "student-park"
      }).attempts
    ).toHaveLength(0);
  });

  it("renders a split two-class layout when the session is configured that way", async () => {
    await renderStudentSessionPage("session-open-split");

    expect(screen.getByText("5-1 반")).toBeInTheDocument();
    expect(screen.getByText("5-2 반")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lee" })).toBeInTheDocument();
  });

  it("shows an instant personal result after submit and hides it on next student reset", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "25" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("즉시 결과");
    expect(screen.getByText("Kim 학생 결과")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다음 학생" }));

    await waitFor(() => {
      expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
      expect(screen.queryByText("Kim 학생 결과")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("앉아윗몸앞으로굽히기 기록")).not.toBeInTheDocument();
    });

    expect(screen.getByText("이름을 선택하세요")).toBeInTheDocument();
  });

  it("keeps the input form visible when submit fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Append failed." }), {
          status: 409,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "25" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Append failed.");
    expect(screen.getByLabelText("앉아윗몸앞으로굽히기 기록")).toBeInTheDocument();
    expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
  });

  it("blocks student submission when the session is closed", async () => {
    await renderStudentSessionPage("session-closed");

    expect(screen.getByText("이 세션은 지금 닫혀 있습니다.")).toBeInTheDocument();
    expect(screen.queryByText("이름을 선택하세요")).not.toBeInTheDocument();

    const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");
    const response = await submitRoute.POST(
      jsonRequest("/api/sessions/session-closed/submit", "POST", {
        studentId: "student-kim",
        measurement: 20
      }),
      {
        params: Promise.resolve({ sessionId: "session-closed" })
      }
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: "Session is closed."
    });
  });
});
