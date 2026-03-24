import { afterEach, describe, expect, it, vi } from "vitest";

import { getGoogleSheetsEnv } from "../../src/lib/env";
import {
  GoogleSheetsAccessError,
  createGoogleSheetsClient
} from "../../src/lib/google/sheets-client";
import {
  assertPapsGoogleSheetTabsMatchPrototype,
  assertPapsGoogleSheetTemplateVersion,
  validatePapsGoogleSheetTemplate
} from "../../src/lib/google/sheets-schema";
import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "../../src/lib/google/template";
import type { GoogleSheetTabPayload } from "../../src/lib/google/sheets";

const createPrototypeTabs = (): GoogleSheetTabPayload[] =>
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab) => ({
    tabName: tab.tabName,
    header: [...tab.header],
    rows: []
  }));

describe("Google Sheets schema and client", () => {
  const originalPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  afterEach(() => {
    if (originalPrivateKey === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = originalPrivateKey;
    }
  });

  it("rejects missing prototype tabs", () => {
    expect(() => assertPapsGoogleSheetTabsMatchPrototype(createPrototypeTabs().slice(0, -1))).toThrow(
      "Manual Google Sheet tabs must match the prototype tab contract."
    );
  });

  it("rejects prototype tabs with the wrong headers", () => {
    const tabs = createPrototypeTabs();
    tabs[0] = {
      ...tabs[0],
      header: [...tabs[0].header, "extra"]
    };

    expect(() => assertPapsGoogleSheetTabsMatchPrototype(tabs)).toThrow(
      "Manual Google Sheet tab 설정 must use the prototype header."
    );
  });

  it("rejects unexpected template versions", () => {
    expect(() => assertPapsGoogleSheetTemplateVersion("v0.0-old")).toThrow(
      "Google Sheets template version v0.0-old does not match v0.1-prototype."
    );
  });

  it("normalizes the service account private key from env", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nline-1\\nline-2\\n-----END PRIVATE KEY-----\\n";

    expect(getGoogleSheetsEnv()).toEqual({
      templateId: null,
      serviceAccountEmail: null,
      serviceAccountPrivateKey:
        "-----BEGIN PRIVATE KEY-----\nline-1\nline-2\n-----END PRIVATE KEY-----\n"
    });
  });

  it("surfaces a readable access error when the service account cannot read the sheet", async () => {
    const client = createGoogleSheetsClient({
      serviceAccountEmail: "service@example.com",
      serviceAccountPrivateKey:
        "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
      accessTokenProvider: async () => "access-token",
      fetchImpl: vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 403,
              status: "PERMISSION_DENIED",
              message: "The caller does not have permission"
            }
          }),
          {
            status: 403,
            headers: {
              "content-type": "application/json"
            }
          }
        );
      })
    });

    await expect(validatePapsGoogleSheetTemplate(client, "sheet-123")).rejects.toBeInstanceOf(
      GoogleSheetsAccessError
    );
    await expect(validatePapsGoogleSheetTemplate(client, "sheet-123")).rejects.toThrow(
      "The service account cannot read spreadsheet sheet-123."
    );
  });
});
