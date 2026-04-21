import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TeacherReturnAccess } from "../../src/components/student/teacher-return-access";

describe("student teacher return access", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens a teacher confirmation modal and redirects on a valid pin", async () => {
    const assignMock = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ nextPath: "/teacher" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        assign: assignMock
      }
    });

    render(<TeacherReturnAccess enabled studentAccessToken="student-access-token" />);

    fireEvent.click(screen.getByRole("button", { name: "교사용 돌아가기" }));
    fireEvent.change(screen.getByLabelText("교사용 PIN"), {
      target: { value: "2468" }
    });
    fireEvent.click(screen.getByRole("button", { name: "교사 확인" }));

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledWith("/teacher");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/teacher/student-return",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          pin: "2468",
          accessToken: "student-access-token"
        })
      })
    );
  });

  it("shows an inline error after an invalid pin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "교사용 PIN이 올바르지 않습니다." }), {
          status: 401,
          headers: {
            "content-type": "application/json"
          }
        })
      )
    );

    render(<TeacherReturnAccess enabled />);

    fireEvent.click(screen.getByRole("button", { name: "교사용 돌아가기" }));
    fireEvent.change(screen.getByLabelText("교사용 PIN"), {
      target: { value: "0000" }
    });
    fireEvent.click(screen.getByRole("button", { name: "교사 확인" }));

    await screen.findByText(/교사용 PIN이 올바르지 않습니다\./);
  });

  it("keeps the teacher button visible but locked when the return PIN is not configured", () => {
    render(<TeacherReturnAccess enabled={false} buttonLabel="교사 관리 화면" />);

    fireEvent.click(screen.getByRole("button", { name: "교사 관리 화면" }));

    expect(
      screen.getByText("교사용 돌아가기 PIN이 아직 설정되지 않았습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("교사용 PIN")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "교사 확인" })).toBeDisabled();
  });
});
