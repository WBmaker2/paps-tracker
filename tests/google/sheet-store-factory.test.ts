import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getGoogleSheetsEnv,
  createGoogleSheetsClient,
  buildStructuredStateFromSheet,
  toTeacherBootstrapFromStructuredState,
  getGoogleSheetClass,
  saveGoogleSheetSchool
} = vi.hoisted(() => ({
  getGoogleSheetsEnv: vi.fn(),
  createGoogleSheetsClient: vi.fn(),
  buildStructuredStateFromSheet: vi.fn(async () => {
    throw new Error("state mock not configured");
  }),
  toTeacherBootstrapFromStructuredState: vi.fn(() => {
    throw new Error("bootstrap mock not configured");
  }),
  getGoogleSheetClass: vi.fn(() => {
    throw new Error("class query mock not configured");
  }),
  saveGoogleSheetSchool: vi.fn(async () => {
    throw new Error("school save mock not configured");
  })
}));

vi.mock("../../src/lib/env", () => ({
  getGoogleSheetsEnv
}));

vi.mock("../../src/lib/google/sheets-client", () => ({
  createGoogleSheetsClient
}));

vi.mock("../../src/lib/google/sheets-bootstrap", () => ({
  buildStructuredStateFromSheet,
  toTeacherBootstrapFromStructuredState
}));

vi.mock("../../src/lib/google/sheet-store-queries", () => ({
  getGoogleSheetClass
}));

vi.mock("../../src/lib/google/sheet-entity-persistence", () => ({
  saveGoogleSheetSchool,
  saveGoogleSheetClass: vi.fn(),
  deleteGoogleSheetClass: vi.fn(),
  saveGoogleSheetStudent: vi.fn(),
  deleteGoogleSheetStudent: vi.fn(),
  saveGoogleSheetSession: vi.fn(),
  deleteGoogleSheetSession: vi.fn()
}));

import {
  createGoogleSheetClientFromEnv,
  createGoogleSheetsStoreForRequest
} from "../../src/lib/google/sheet-store-factory";
import { GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR } from "../../src/lib/google/sheet-connection-status";

describe("Google Sheet store factory", () => {
  beforeEach(() => {
    getGoogleSheetsEnv.mockReset();
    createGoogleSheetsClient.mockReset();
    buildStructuredStateFromSheet.mockReset();
    toTeacherBootstrapFromStructuredState.mockReset();
    getGoogleSheetClass.mockReset();
    saveGoogleSheetSchool.mockReset();
  });

  it("rejects missing service account credentials from env", () => {
    getGoogleSheetsEnv.mockReturnValue({
      templateId: null,
      serviceAccountEmail: null,
      serviceAccountPrivateKey: null
    });

    expect(() => createGoogleSheetClientFromEnv()).toThrow(GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR);
  });

  it("creates a Google Sheets client from env credentials", () => {
    const client = { kind: "google-client" };

    getGoogleSheetsEnv.mockReturnValue({
      templateId: null,
      serviceAccountEmail: "service@example.com",
      serviceAccountPrivateKey: "private-key"
    });
    createGoogleSheetsClient.mockReturnValue(client);

    expect(createGoogleSheetClientFromEnv()).toBe(client);
    expect(createGoogleSheetsClient).toHaveBeenCalledWith({
      serviceAccountEmail: "service@example.com",
      serviceAccountPrivateKey: "private-key"
    });
  });

  it("wires store queries and persistence through the provided client", async () => {
    const client = { kind: "google-client" };
    const state = { marker: "state" };
    const bootstrap = {
      teacher: { id: "teacher-1" },
      assessmentRounds: [],
      studentRoundResults: []
    };
    const classroom = { id: "class-1" };
    const school = { id: "school-1" };

    buildStructuredStateFromSheet.mockResolvedValue(state);
    toTeacherBootstrapFromStructuredState.mockReturnValue(bootstrap);
    getGoogleSheetClass.mockReturnValue(classroom);
    saveGoogleSheetSchool.mockResolvedValue(school);

    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId: "sheet-123",
      teacherEmail: "teacher@example.com",
      client: client as never
    });

    await expect(store.getTeacherBootstrap({ teacherEmail: "other@example.com" })).resolves.toEqual(
      bootstrap
    );
    await expect(store.getClass("class-1")).resolves.toBe(classroom);
    await expect(store.saveSchool(school as never)).resolves.toBe(school);

    expect(buildStructuredStateFromSheet).toHaveBeenCalledWith({
      client,
      spreadsheetId: "sheet-123",
      teacherEmail: "teacher@example.com"
    });
    expect(toTeacherBootstrapFromStructuredState).toHaveBeenCalledWith(state, "other@example.com");
    expect(getGoogleSheetClass).toHaveBeenCalledWith(state, "class-1");
    expect(saveGoogleSheetSchool).toHaveBeenCalledWith({
      client,
      spreadsheetId: "sheet-123",
      state,
      school
    });
    expect(buildStructuredStateFromSheet).toHaveBeenCalledTimes(1);
  });
});
