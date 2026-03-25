import { afterEach, describe, expect, it } from "vitest";

import { getGoogleSheetsSetupStatus, getNextAuthSecret } from "../../src/lib/env";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ORIGINAL_GOOGLE_SHEETS_TEMPLATE_ID = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
const ORIGINAL_GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const ORIGINAL_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

describe("env helpers", () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;

    if (ORIGINAL_NEXTAUTH_SECRET === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
    }

    if (ORIGINAL_GOOGLE_SHEETS_TEMPLATE_ID === undefined) {
      delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    } else {
      process.env.GOOGLE_SHEETS_TEMPLATE_ID = ORIGINAL_GOOGLE_SHEETS_TEMPLATE_ID;
    }

    if (ORIGINAL_GOOGLE_SERVICE_ACCOUNT_EMAIL === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = ORIGINAL_GOOGLE_SERVICE_ACCOUNT_EMAIL;
    }

    if (ORIGINAL_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY === undefined) {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    } else {
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
        ORIGINAL_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    }
  });

  it("uses an explicit NEXTAUTH_SECRET when provided", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXTAUTH_SECRET = "configured-secret";

    expect(getNextAuthSecret()).toBe("configured-secret");
  });

  it("falls back to a development secret outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXTAUTH_SECRET;

    expect(getNextAuthSecret()).toBe("paps-tracker-dev-secret");
  });

  it("requires a real secret in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXTAUTH_SECRET;

    expect(getNextAuthSecret()).toBeNull();
  });

  it("reports missing Google Sheets setup keys explicitly", () => {
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    expect(getGoogleSheetsSetupStatus()).toEqual({
      templateConfigured: false,
      serviceAccountConfigured: false,
      serviceAccountEmail: null,
      missingKeys: [
        "GOOGLE_SHEETS_TEMPLATE_ID",
        "GOOGLE_SERVICE_ACCOUNT_EMAIL",
        "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
      ]
    });
  });

  it("marks Google Sheets setup ready when template and service account are configured", () => {
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nmock-key\\n-----END PRIVATE KEY-----\\n";

    expect(getGoogleSheetsSetupStatus()).toEqual({
      templateConfigured: true,
      serviceAccountConfigured: true,
      serviceAccountEmail: "service-account@example.com",
      missingKeys: []
    });
  });
});
