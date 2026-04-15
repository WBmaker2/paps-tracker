import { afterEach, describe, expect, it } from "vitest";

import {
  createStudentSessionAccessToken,
  resolveStudentSessionAccess
} from "../../src/lib/student-session-access";

const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("student session access token", () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;

    if (ORIGINAL_NEXTAUTH_SECRET === undefined) {
      delete process.env.NEXTAUTH_SECRET;
    } else {
      process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
    }
  });

  it("round-trips a session-specific spreadsheet binding", () => {
    process.env.NODE_ENV = "test";
    process.env.NEXTAUTH_SECRET = "test-secret";

    const token = createStudentSessionAccessToken({
      sessionId: "session-1",
      spreadsheetId: "sheet-123"
    });

    expect(
      resolveStudentSessionAccess({
        token,
        sessionId: "session-1"
      })
    ).toEqual({
      spreadsheetId: "sheet-123"
    });
  });

  it("rejects a token when the route session id does not match", () => {
    process.env.NODE_ENV = "test";
    process.env.NEXTAUTH_SECRET = "test-secret";

    const token = createStudentSessionAccessToken({
      sessionId: "session-1",
      spreadsheetId: "sheet-123"
    });

    expect(() =>
      resolveStudentSessionAccess({
        token,
        sessionId: "session-2"
      })
    ).toThrow("Student session access token does not match this session.");
  });

  it("rejects a tampered token", () => {
    process.env.NODE_ENV = "test";
    process.env.NEXTAUTH_SECRET = "test-secret";

    const token = createStudentSessionAccessToken({
      sessionId: "session-1",
      spreadsheetId: "sheet-123"
    });
    const [payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        sessionId: "session-1",
        spreadsheetId: "sheet-999"
      })
    ).toString("base64url");

    expect(() =>
      resolveStudentSessionAccess({
        token: `${tamperedPayload}.${signature}`,
        sessionId: "session-1"
      })
    ).toThrow("Invalid student session access token.");
  });
});
