import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn(() => {
  throw new Error("REDIRECT");
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock
}));

vi.mock("../../src/auth", () => ({
  auth: vi.fn(async () => null)
}));

describe("teacher auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated teachers to the custom sign-in page", async () => {
    const teacherAuthModule = await import("../../src/lib/teacher-auth");

    await expect(teacherAuthModule.requireTeacherSession()).rejects.toThrow("REDIRECT");
    expect(redirectMock).toHaveBeenCalledWith("/auth/signin");
  });
});
