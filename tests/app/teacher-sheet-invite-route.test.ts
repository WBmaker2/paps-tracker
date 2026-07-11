import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireTeacherRouteSession, getAuthorizedTeacherRouteContext } = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn(),
  getAuthorizedTeacherRouteContext: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession
}));

vi.mock("../../src/lib/teacher-route-context", () => ({
  getAuthorizedTeacherRouteContext
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  createTeacherRuntimeStoreForRequest: vi.fn()
}));

const ORIGINAL_ALLOWLIST = process.env.TEACHER_EMAIL_ALLOWLIST;
const ORIGINAL_HOSTED_DOMAIN = process.env.GOOGLE_HOSTED_DOMAIN;
const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

const request = (body: unknown, withCookie = true) =>
  new NextRequest("http://localhost/api/google-sheet/teacher-invite", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withCookie ? { cookie: "paps-spreadsheet-id=sheet-123" } : {})
    },
    body: JSON.stringify(body)
  });

describe("teacher sheet invitation route", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "invite-route-secret";
    process.env.TEACHER_EMAIL_ALLOWLIST =
      "owner@example.com,new-teacher@example.com";
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    requireTeacherRouteSession.mockResolvedValue({
      ok: true,
      session: {
        email: "owner@example.com",
        name: "Owner",
        image: null
      }
    });
    getAuthorizedTeacherRouteContext.mockResolvedValue({
      store: {},
      teacher: {
        id: "owner",
        schoolId: "school-1",
        name: "Owner",
        email: "owner@example.com"
      },
      bootstrap: {
        teachers: [{ email: "owner@example.com" }]
      }
    });
  });

  afterEach(() => {
    process.env.TEACHER_EMAIL_ALLOWLIST = ORIGINAL_ALLOWLIST;
    process.env.GOOGLE_HOSTED_DOMAIN = ORIGINAL_HOSTED_DOMAIN;
    process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
    vi.clearAllMocks();
  });

  it("returns the authentication response before issuing an approval", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    });
    const route = await import("../../app/api/google-sheet/teacher-invite/route");

    const response = await route.POST(request({ targetEmail: "new-teacher@example.com" }));

    expect(response.status).toBe(401);
    expect(getAuthorizedTeacherRouteContext).not.toHaveBeenCalled();
  });

  it("issues a target-bound 15 minute approval for an authorized sheet teacher", async () => {
    const route = await import("../../app/api/google-sheet/teacher-invite/route");

    const response = await route.POST(request({ targetEmail: "new-teacher@example.com" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      targetEmail: "new-teacher@example.com",
      expiresInSeconds: 900
    });
    expect(typeof payload.inviteToken).toBe("string");
    expect(getAuthorizedTeacherRouteContext).toHaveBeenCalledTimes(1);
  });

  it("does not invite an email outside the configured teacher access scope", async () => {
    const route = await import("../../app/api/google-sheet/teacher-invite/route");

    const response = await route.POST(request({ targetEmail: "outsider@example.com" }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "초대할 교사 이메일이 로그인 허용 범위에 없습니다."
    });
  });
});
