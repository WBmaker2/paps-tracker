import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/auth", () => ({
  signIn: vi.fn()
}));

const ORIGINAL_ENV = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_HOSTED_DOMAIN: process.env.GOOGLE_HOSTED_DOMAIN,
  TEACHER_EMAIL_ALLOWLIST: process.env.TEACHER_EMAIL_ALLOWLIST
};

describe("auth sign-in page", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = ORIGINAL_ENV.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_CLIENT_SECRET = ORIGINAL_ENV.GOOGLE_CLIENT_SECRET;
    process.env.GOOGLE_HOSTED_DOMAIN = ORIGINAL_ENV.GOOGLE_HOSTED_DOMAIN;
    process.env.TEACHER_EMAIL_ALLOWLIST = ORIGINAL_ENV.TEACHER_EMAIL_ALLOWLIST;
  });

  it("shows setup guidance when Google OAuth is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;

    const pageModule = await import("../../app/auth/signin/page");

    render(await pageModule.default());

    expect(screen.getByText("교사 로그인 설정 필요")).toBeInTheDocument();
    expect(screen.getByText("GOOGLE_CLIENT_ID")).toBeInTheDocument();
    expect(screen.getByText("GOOGLE_CLIENT_SECRET")).toBeInTheDocument();
  });

  it("shows a Google sign-in button when auth config exists", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    delete process.env.TEACHER_EMAIL_ALLOWLIST;
    delete process.env.GOOGLE_HOSTED_DOMAIN;

    const pageModule = await import("../../app/auth/signin/page");

    render(await pageModule.default());

    const button = screen.getByRole("button", { name: "Google로 교사 로그인" });

    expect(button).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("link", { name: "Google로 교사 로그인" })).not.toBeInTheDocument();
  });
});
