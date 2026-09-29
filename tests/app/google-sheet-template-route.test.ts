import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleSheetsAccessError } from "../../src/lib/google/sheets-client";

const { requireTeacherRouteSession, createGoogleSheetClientFromEnv } = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn(),
  createGoogleSheetClientFromEnv: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({ requireTeacherRouteSession }));
vi.mock("../../src/lib/google/sheet-store-factory", () => ({ createGoogleSheetClientFromEnv }));
vi.mock("../../src/lib/env", () => ({
  getGoogleSheetsEnv: () => ({ serviceAccountEmail: "paps-bot@example.invalid" })
}));
vi.mock("../../src/lib/google/template", () => ({
  resolveGoogleSheetsTemplateLink: () => ({
    templateSpreadsheetId: "private-template-id",
    templateUrl: "https://docs.google.com/spreadsheets/d/private-template-id/edit",
    copyUrl: "https://docs.google.com/spreadsheets/d/private-template-id/copy"
  })
}));

describe("Google Sheets template access route", () => {
  afterEach(() => vi.clearAllMocks());

  it("only reports readiness after the remote spreadsheet can be read", async () => {
    requireTeacherRouteSession.mockResolvedValue({ ok: true, session: { email: "teacher@example.com" } });
    const getSpreadsheet = vi.fn().mockResolvedValue({ spreadsheetId: "private-template-id" });
    createGoogleSheetClientFromEnv.mockReturnValue({ getSpreadsheet });
    const route = await import("../../app/api/google-sheet/template/route");

    const response = await route.POST(
      new NextRequest("http://localhost/api/google-sheet/template", { method: "POST", body: "{}" })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, templateAccessible: true });
    expect(getSpreadsheet).toHaveBeenCalledWith("private-template-id");
  });

  it("returns a safe recovery message when the configured remote template is unavailable", async () => {
    requireTeacherRouteSession.mockResolvedValue({ ok: true, session: { email: "teacher@example.com" } });
    const getSpreadsheet = vi.fn().mockRejectedValue(new GoogleSheetsAccessError("private-template-id", 404));
    createGoogleSheetClientFromEnv.mockReturnValue({ getSpreadsheet });
    const route = await import("../../app/api/google-sheet/template/route");

    const response = await route.POST(
      new NextRequest("http://localhost/api/google-sheet/template", { method: "POST", body: "{}" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ ok: false, code: "template_unavailable" });
    expect(body.error).toContain("이미 사용하는 시트 URL");
    expect(JSON.stringify(body)).not.toContain("private-template-id");
    expect(JSON.stringify(body)).not.toContain("The service account");
  });
});
