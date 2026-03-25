import { afterEach, describe, expect, it, vi } from "vitest";

import { getGoogleSheetsEnv } from "../../src/lib/env";
import {
  GoogleSheetsApiDisabledError,
  GoogleSheetsAccessError,
  createGoogleSheetsClient
} from "../../src/lib/google/sheets-client";
import {
  assertPapsGoogleSheetTabsMatchPrototype,
  assertPapsGoogleSheetTemplateVersion,
  validatePapsGoogleSheetTemplate
} from "../../src/lib/google/sheets-schema";
import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "../../src/lib/google/template";
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

  it("validates a matching prototype sheet with the expected version row", async () => {
    const readRange = vi.fn(async (spreadsheetId: string, range: string) => {
      if (range === "'설정'!A1:C20") {
        return [
          ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정"],
          [PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL, PAPS_GOOGLE_SHEET_TEMPLATE_VERSION, "프로토타입 예시"]
        ];
      }

      const tabName = range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";
      const prototypeTab = PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.find((tab) => tab.tabName === tabName);

      expect(spreadsheetId).toBe("sheet-123");
      expect(prototypeTab).toBeDefined();

      return [prototypeTab?.header ?? []];
    });
    const client = createGoogleSheetsClient({
      serviceAccountEmail: "service@example.com",
      serviceAccountPrivateKey:
        "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
      accessTokenProvider: async () => "access-token",
      fetchImpl: vi.fn()
    });

    vi.spyOn(client, "getSpreadsheet").mockResolvedValue({
      spreadsheetId: "sheet-123",
      sheets: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab, index) => ({
        properties: {
          sheetId: index + 1,
          title: tab.tabName
        }
      }))
    });
    vi.spyOn(client, "readRange").mockImplementation(readRange);

    await expect(validatePapsGoogleSheetTemplate(client, "sheet-123")).resolves.toEqual({
      spreadsheet: {
        spreadsheetId: "sheet-123",
        sheets: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab, index) => ({
          properties: {
            sheetId: index + 1,
            title: tab.tabName
          }
        }))
      },
      templateVersion: PAPS_GOOGLE_SHEET_TEMPLATE_VERSION
    });
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
      "The service account cannot access spreadsheet sheet-123."
    );
  });

  it("surfaces a readable error when Google Sheets API is disabled", async () => {
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
              message:
                "Google Sheets API has not been used in project 1085328819177 before or it is disabled.",
              details: [
                {
                  "@type": "type.googleapis.com/google.rpc.ErrorInfo",
                  reason: "SERVICE_DISABLED",
                  metadata: {
                    service: "sheets.googleapis.com",
                    consumer: "projects/1085328819177"
                  }
                }
              ]
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
      GoogleSheetsApiDisabledError
    );
    await expect(validatePapsGoogleSheetTemplate(client, "sheet-123")).rejects.toThrow(
      "Google Sheets API is disabled in the Google Cloud project (1085328819177). Enable it and try again."
    );
  });

  it("sends the expected request headers for appendRows and updateRange", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const method = (init?.method ?? "GET").toUpperCase();
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;

      if (url.includes(":append")) {
        expect(method).toBe("POST");
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer access-token",
          Accept: "application/json",
          "content-type": "application/json"
        });
        expect(body).toEqual({ values: [["row-1", 42]] });
      }

      if (url.includes("/values/") && !url.includes(":append")) {
        expect(init?.headers).toMatchObject({
          Authorization: "Bearer access-token",
          Accept: "application/json",
          "content-type": "application/json"
        });
        expect(body).toEqual({ values: [["항목", "값", "설명"]] });
      }

      return new Response(
        JSON.stringify({
          spreadsheetId: "sheet-123",
          updates: {
            spreadsheetId: "sheet-123",
            updatedRange: "A1:B2"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    const client = createGoogleSheetsClient({
      serviceAccountEmail: "service@example.com",
      serviceAccountPrivateKey:
        "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
      accessTokenProvider: async () => "access-token",
      fetchImpl
    });

    await client.appendRows("sheet-123", "'세션기록'!A1", [
      ["row-1", 42]
    ]);
    await client.updateRange("sheet-123", "'설정'!A1:C2", [["항목", "값", "설명"]]);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
