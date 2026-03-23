import { afterEach, describe, expect, it } from "vitest";

import { getNextAuthSecret } from "../../src/lib/env";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

describe("env helpers", () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;

    if (ORIGINAL_NEXTAUTH_SECRET === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
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
});
