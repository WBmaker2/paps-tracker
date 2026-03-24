import {
  createGoogleSheetsCopyLink,
  parseGoogleSheetsUrl,
  validateGoogleSheetsUrl
} from "../../src/lib/google/drive-link";
import { isTeacherEmailAllowed } from "../../src/lib/env";
import { parseGoogleSheetTabPayloads } from "../../src/lib/google/sheets";
import { resolveGoogleSheetsTemplateLink } from "../../src/lib/google/template";

const ENV_KEYS = [
  "TEACHER_EMAIL_ALLOWLIST",
  "GOOGLE_HOSTED_DOMAIN",
  "GOOGLE_SHEETS_TEMPLATE_ID"
] as const;

const withEnv = (
  values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>,
  callback: () => void
) => {
  const previousValues = Object.fromEntries(
    ENV_KEYS.map((key) => [key, process.env[key]])
  ) as Record<(typeof ENV_KEYS)[number], string | undefined>;

  for (const key of ENV_KEYS) {
    const nextValue = values[key];

    if (nextValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = nextValue;
    }
  }

  try {
    callback();
  } finally {
    for (const key of ENV_KEYS) {
      const previousValue = previousValues[key];

      if (previousValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previousValue;
      }
    }
  }
};

describe("Google Sheets URL utilities", () => {
  it("fails closed for teacher access when no allowlist or hosted domain is configured", () => {
    withEnv({}, () => {
      expect(isTeacherEmailAllowed("teacher@example.com")).toBe(false);
    });
  });

  it("parses a standard edit URL and preserves the gid", () => {
    expect(
      parseGoogleSheetsUrl(
        "https://docs.google.com/spreadsheets/d/1AbCDefGhIJklMNopQRstuVWxyz1234567890/edit#gid=987654321"
      )
    ).toEqual({
      spreadsheetId: "1AbCDefGhIJklMNopQRstuVWxyz1234567890",
      gid: "987654321",
      isCopyLink: false,
      normalizedUrl:
        "https://docs.google.com/spreadsheets/d/1AbCDefGhIJklMNopQRstuVWxyz1234567890/edit#gid=987654321"
    });
  });

  it("parses the spreadsheet id from a minimal docs.google.com sheet URL", () => {
    expect(parseGoogleSheetsUrl("https://docs.google.com/spreadsheets/d/1sheetIdXYZ987")).toEqual({
      spreadsheetId: "1sheetIdXYZ987",
      gid: null,
      isCopyLink: false,
      normalizedUrl: "https://docs.google.com/spreadsheets/d/1sheetIdXYZ987/edit"
    });
  });

  it("parses Google Sheets URLs that include a user segment", () => {
    expect(
      parseGoogleSheetsUrl(
        "https://docs.google.com/spreadsheets/u/1/d/1sheetIdXYZ987/edit?usp=sharing"
      )
    ).toEqual({
      spreadsheetId: "1sheetIdXYZ987",
      gid: null,
      isCopyLink: false,
      normalizedUrl: "https://docs.google.com/spreadsheets/d/1sheetIdXYZ987/edit"
    });
  });

  it("accepts share URLs that use the view action", () => {
    expect(
      parseGoogleSheetsUrl(
        "https://docs.google.com/spreadsheets/d/1sheetIdXYZ987/view?usp=sharing#gid=123"
      )
    ).toEqual({
      spreadsheetId: "1sheetIdXYZ987",
      gid: "123",
      isCopyLink: false,
      normalizedUrl: "https://docs.google.com/spreadsheets/d/1sheetIdXYZ987/edit#gid=123"
    });
  });

  it("marks copy links as copy links", () => {
    expect(
      parseGoogleSheetsUrl("https://docs.google.com/spreadsheets/d/1templateSheetId/copy")
    ).toEqual({
      spreadsheetId: "1templateSheetId",
      gid: null,
      isCopyLink: true,
      normalizedUrl: "https://docs.google.com/spreadsheets/d/1templateSheetId/copy"
    });
  });

  it("returns a validation error for non-Sheets Google URLs", () => {
    expect(
      validateGoogleSheetsUrl("https://docs.google.com/document/d/123456/edit")
    ).toEqual({
      ok: false,
      error: "Google Sheets URL must point to a spreadsheet."
    });
  });

  it("returns a validation error for malformed input", () => {
    expect(validateGoogleSheetsUrl("not a url")).toEqual({
      ok: false,
      error: "Google Sheets URL must be a valid URL."
    });
  });

  it("builds a copy link from a parsed template URL", () => {
    const parsed = parseGoogleSheetsUrl(
      "https://docs.google.com/spreadsheets/d/1templateSheetId/edit#gid=0"
    );

    expect(createGoogleSheetsCopyLink(parsed)).toBe(
      "https://docs.google.com/spreadsheets/d/1templateSheetId/copy"
    );
  });

  it("rejects malformed tab payloads instead of silently dropping them", () => {
    expect(() =>
      parseGoogleSheetTabPayloads([
        {
          tabName: "Results",
          header: ["name", "score"],
          rows: [["Kim", 12], { bad: true }]
        }
      ])
    ).toThrow("Each Google Sheet row must be an array.");
  });

  it("rejects non-scalar header values instead of coercing them to strings", () => {
    expect(() =>
      parseGoogleSheetTabPayloads([
        {
          tabName: "Results",
          header: ["name", { bad: true }],
          rows: [["Kim", 12]]
        }
      ])
    ).toThrow("Google Sheet header values must be string, number, boolean, or null.");
  });

  it("prefers an explicit templateId over an invalid optional templateUrl", () => {
    expect(
      resolveGoogleSheetsTemplateLink({
        templateId: "sheet-from-id",
        templateUrl: "not a url"
      })
    ).toEqual({
      templateSpreadsheetId: "sheet-from-id",
      templateUrl: "https://docs.google.com/spreadsheets/d/sheet-from-id/edit",
      copyUrl: "https://docs.google.com/spreadsheets/d/sheet-from-id/copy"
    });
  });

  it("falls back to the env template id when templateUrl is invalid", () => {
    withEnv({ GOOGLE_SHEETS_TEMPLATE_ID: "sheet-from-env" }, () => {
      expect(
        resolveGoogleSheetsTemplateLink({
          templateUrl: "not a url"
        })
      ).toEqual({
        templateSpreadsheetId: "sheet-from-env",
        templateUrl: "https://docs.google.com/spreadsheets/d/sheet-from-env/edit",
        copyUrl: "https://docs.google.com/spreadsheets/d/sheet-from-env/copy"
        });
    });
  });

  it("prefers an explicit templateUrl over the env template id when both are present", () => {
    withEnv({ GOOGLE_SHEETS_TEMPLATE_ID: "sheet-from-env" }, () => {
      expect(
        resolveGoogleSheetsTemplateLink({
          templateUrl: "https://docs.google.com/spreadsheets/d/sheet-from-url/view?usp=sharing"
        })
      ).toEqual({
        templateSpreadsheetId: "sheet-from-url",
        templateUrl: "https://docs.google.com/spreadsheets/d/sheet-from-url/edit",
        copyUrl: "https://docs.google.com/spreadsheets/d/sheet-from-url/copy"
      });
    });
  });
});
