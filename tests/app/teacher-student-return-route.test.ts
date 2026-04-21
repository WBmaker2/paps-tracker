import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getTeacherSession, isTeacherReturnPinEnabled, verifyTeacherReturnPin } = vi.hoisted(() => ({
  getTeacherSession: vi.fn(),
  isTeacherReturnPinEnabled: vi.fn(),
  verifyTeacherReturnPin: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  getTeacherSession
}));

vi.mock("../../src/lib/teacher-return", () => ({
  isTeacherReturnPinEnabled,
  verifyTeacherReturnPin
}));

describe("teacher student return route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns unavailable when the teacher return pin is not configured", async () => {
    isTeacherReturnPinEnabled.mockReturnValueOnce(false);

    const route = await import("../../app/api/teacher/student-return/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/teacher/student-return", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ pin: "2468" })
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "교사용 돌아가기 PIN이 아직 설정되지 않았습니다."
    });
  });

  it("rejects an invalid teacher pin", async () => {
    isTeacherReturnPinEnabled.mockReturnValueOnce(true);
    verifyTeacherReturnPin.mockReturnValueOnce(false);

    const route = await import("../../app/api/teacher/student-return/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/teacher/student-return", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ pin: "0000" })
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "교사용 PIN이 올바르지 않습니다. (4회 남음)"
    });
  });

  it("returns the teacher dashboard when a teacher session already exists", async () => {
    isTeacherReturnPinEnabled.mockReturnValueOnce(true);
    verifyTeacherReturnPin.mockReturnValueOnce(true);
    getTeacherSession.mockResolvedValueOnce({
      email: "teacher@example.com",
      name: "홍교사",
      image: null
    });

    const route = await import("../../app/api/teacher/student-return/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/teacher/student-return", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ pin: "2468" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nextPath: "/teacher"
    });
  });

  it("sends the user to teacher sign-in when no teacher session exists", async () => {
    isTeacherReturnPinEnabled.mockReturnValueOnce(true);
    verifyTeacherReturnPin.mockReturnValueOnce(true);
    getTeacherSession.mockResolvedValueOnce(null);

    const route = await import("../../app/api/teacher/student-return/route");
    const response = await route.POST(
      new NextRequest("http://localhost/api/teacher/student-return", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ pin: "2468" })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      nextPath: "/auth/signin"
    });
  });
});
