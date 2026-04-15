import { afterEach, describe, expect, it } from "vitest";

describe("health route", () => {
  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_HOSTED_DOMAIN;
    delete process.env.TEACHER_EMAIL_ALLOWLIST;
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("returns liveness plus readiness details for health checks", async () => {
    const routeModule = await import("../../app/api/health/route");

    const response = await routeModule.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "paps-tracker",
      ready: false,
      checks: {
        googleOAuth: {
          ready: false,
          missingKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
        },
        teacherAccess: {
          ready: false,
          hostedDomain: null,
          allowlistCount: 0
        },
        googleSheets: {
          ready: false,
          missingKeys: [
            "GOOGLE_SHEETS_TEMPLATE_ID",
            "GOOGLE_SERVICE_ACCOUNT_EMAIL",
            "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
          ]
        }
      }
    });
  });

  it("marks readiness true when auth, access policy, and sheets env are configured", async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_HOSTED_DOMAIN = "school.kr";
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nmock-key\\n-----END PRIVATE KEY-----\\n";

    const routeModule = await import("../../app/api/health/route");
    const response = await routeModule.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      service: "paps-tracker",
      ready: true,
      checks: {
        googleOAuth: {
          ready: true
        },
        teacherAccess: {
          ready: true,
          hostedDomain: "school.kr",
          allowlistCount: 0
        },
        googleSheets: {
          ready: true,
          missingKeys: []
        }
      }
    });
  });
});
