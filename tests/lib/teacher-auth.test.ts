import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn(() => {
  throw new Error("REDIRECT");
});
const authMock = vi.fn(async () => null);

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../../src/auth", () => ({
  auth: authMock
}));

describe("teacher auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    authMock.mockReset();
    authMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated teachers to the custom sign-in page", async () => {
    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/auth/signin");
  });

  it("accepts any signed-in Google session with an email", async () => {
    authMock.mockResolvedValue({
      user: {
        email: "teacher@example.com",
        name: "Teacher",
        image: null
      }
    });

    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).resolves.toMatchObject({
      email: "teacher@example.com",
      name: "Teacher"
    });
  });
});
