import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
  requireTeacherRouteSession,
  createGoogleSheetClientFromEnv,
  readTeacherSheetVersion
} = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn(),
  createGoogleSheetClientFromEnv: vi.fn(),
  readTeacherSheetVersion: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  createGoogleSheetClientFromEnv
}));

vi.mock("../../src/lib/google/sheet-state-version", () => ({
  readTeacherSheetVersion
}));

describe("teacher state version route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when the teacher session is missing", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    });

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/state-version"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns a version for a connected teacher sheet", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    createGoogleSheetClientFromEnv.mockReturnValueOnce({ kind: "google-client" });
    readTeacherSheetVersion.mockResolvedValueOnce({
      connected: true,
      version: "version-123",
      reason: null
    });

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/teacher/state-version", {
        headers: {
          cookie: "paps-spreadsheet-id=sheet-live"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      version: "version-123",
      reason: null
    });
    expect(readTeacherSheetVersion).toHaveBeenCalledWith({
      client: { kind: "google-client" },
      teacherEmail: "teacher@example.com",
      spreadsheetId: "sheet-live"
    });
  });

  it("returns a disconnected payload when the teacher has no live sheet state", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/state-version"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      connected: false,
      version: null,
      reason: "not_connected"
    });
  });

  it("returns a disconnected payload when the sheet version reader reports unauthorized teacher access", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    createGoogleSheetClientFromEnv.mockReturnValueOnce({ kind: "google-client" });
    readTeacherSheetVersion.mockResolvedValueOnce({
      connected: false,
      version: null,
      reason: "teacher_not_authorized"
    });

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/teacher/state-version", {
        headers: {
          cookie: "paps-spreadsheet-id=sheet-live"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      connected: false,
      version: null,
      reason: "teacher_not_authorized"
    });
  });
});
