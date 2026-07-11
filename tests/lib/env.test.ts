import { afterEach, describe, expect, it } from "vitest";

import {
  getGoogleSheetsSetupStatus,
  getNextAuthSecret,
  hasStudentTeacherPin,
  hasTeacherAccessConfig,
  isTeacherEmailAllowed
} from "../../src/lib/env";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ORIGINAL_GOOGLE_SHEETS_TEMPLATE_ID = process.env.GOOGLE_SHEETS_TEMPLATE_ID;
const ORIGINAL_GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const ORIGINAL_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
const ORIGINAL_GOOGLE_HOSTED_DOMAIN = process.env.GOOGLE_HOSTED_DOMAIN;
const ORIGINAL_TEACHER_EMAIL_ALLOWLIST = process.env.TEACHER_EMAIL_ALLOWLIST;
const ORIGINAL_STUDENT_TEACHER_PIN = process.env.STUDENT_TEACHER_PIN;

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

    if (ORIGINAL_GOOGLE_HOSTED_DOMAIN === undefined) {
      delete process.env.GOOGLE_HOSTED_DOMAIN;
    } else {
      process.env.GOOGLE_HOSTED_DOMAIN = ORIGINAL_GOOGLE_HOSTED_DOMAIN;
    }

    if (ORIGINAL_TEACHER_EMAIL_ALLOWLIST === undefined) {
      delete process.env.TEACHER_EMAIL_ALLOWLIST;
    } else {
      process.env.TEACHER_EMAIL_ALLOWLIST = ORIGINAL_TEACHER_EMAIL_ALLOWLIST;
    }

    if (ORIGINAL_STUDENT_TEACHER_PIN === undefined) {
      delete process.env.STUDENT_TEACHER_PIN;
    } else {
      process.env.STUDENT_TEACHER_PIN = ORIGINAL_STUDENT_TEACHER_PIN;
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

    expect(() => getNextAuthSecret()).toThrow(
      "Missing required environment variable NEXTAUTH_SECRET."
    );
  });

  it("denies teacher access when neither domain nor allowlist is configured", () => {
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;

    expect(hasTeacherAccessConfig()).toBe(false);
    expect(isTeacherEmailAllowed("teacher@example.com")).toBe(false);
  });

  it("allows a teacher when the email matches the hosted domain", () => {
    process.env.GOOGLE_HOSTED_DOMAIN = "school.example.com";
    delete process.env.TEACHER_EMAIL_ALLOWLIST;

    expect(hasTeacherAccessConfig()).toBe(true);
    expect(isTeacherEmailAllowed("teacher@school.example.com")).toBe(true);
    expect(isTeacherEmailAllowed("teacher@example.com")).toBe(false);
  });

  it("allows a teacher when the email is included in the allowlist", () => {
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    process.env.TEACHER_EMAIL_ALLOWLIST = "lead@example.com, teacher@example.com ";

    expect(hasTeacherAccessConfig()).toBe(true);
    expect(isTeacherEmailAllowed("teacher@example.com")).toBe(true);
    expect(isTeacherEmailAllowed("other@example.com")).toBe(false);
  });

  it("reports whether the student screen teacher return pin is configured", () => {
    delete process.env.STUDENT_TEACHER_PIN;
    expect(hasStudentTeacherPin()).toBe(false);

    process.env.STUDENT_TEACHER_PIN = "2468";
    expect(hasStudentTeacherPin()).toBe(true);
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
