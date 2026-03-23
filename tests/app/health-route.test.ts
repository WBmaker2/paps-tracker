import { describe, expect, it } from "vitest";

describe("health route", () => {
  it("returns an ok payload for Render health checks", async () => {
    const routeModule = await import("../../app/api/health/route");

    const response = await routeModule.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "paps-tracker"
    });
  });
});
