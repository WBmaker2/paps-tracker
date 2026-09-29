import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { getRequestStore, resetRequestStore } from "../../src/lib/store/paps-memory-store";
import { buildStudentSeed, installStudentApiFetch, jsonRequest, renderStudentSessionPage } from "./student-session-test-helpers";

describe("student session flow", () => {
  beforeEach(() => resetRequestStore(buildStudentSeed()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock("../../src/lib/paps/grade");
    resetRequestStore();
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
    expect(screen.getAllByRole("link", { name: "홈으로 돌아가기" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "교사 관리 화면" })).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "다음 학생" }));

    await waitFor(() => {
      expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
      expect(screen.queryByText("Kim 학생 결과")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("앉아윗몸앞으로굽히기 기록")).not.toBeInTheDocument();
    });

    expect(screen.getByText("이름을 선택하세요")).toBeInTheDocument();
  });

  it("allows switching to another student from the name list after submit", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "25" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");

    fireEvent.click(screen.getByRole("button", { name: "Park" }));

    await waitFor(() => {
      expect(screen.queryByText("Kim 학생 결과")).not.toBeInTheDocument();
      expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Park" })).toBeInTheDocument();
      expect(screen.getByLabelText("앉아윗몸앞으로굽히기 기록")).toBeInTheDocument();
    });
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

    await screen.findByText("기록을 저장하지 못했어요. 입력값과 인터넷 연결을 확인한 뒤 다시 제출해 주세요.");
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
