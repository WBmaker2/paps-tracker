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
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;
  });

  it("redirects unauthenticated teachers to the custom sign-in page", async () => {
    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/auth/signin");
  });

  it("accepts a signed-in teacher within the configured access scope", async () => {
    process.env.GOOGLE_HOSTED_DOMAIN = "school.example.com";
    authMock.mockResolvedValue({
      user: {
        email: "teacher@school.example.com",
        name: "Teacher",
        image: null
      }
    });

    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).resolves.toMatchObject({
      email: "teacher@school.example.com",
      name: "Teacher"
    });
  });

  it("redirects signed-in users outside the configured access scope", async () => {
    process.env.TEACHER_EMAIL_ALLOWLIST = "lead@school.example.com";
    authMock.mockResolvedValue({
      user: {
        email: "teacher@school.example.com",
        name: "Teacher",
        image: null
      }
    });

    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/auth/signin");
  });

  it("redirects signed-in users when no access scope is configured", async () => {
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;
    authMock.mockResolvedValue({
      user: {
        email: "teacher@school.example.com",
        name: "Teacher",
        image: null
      }
    });

    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/auth/signin");
  });
});
