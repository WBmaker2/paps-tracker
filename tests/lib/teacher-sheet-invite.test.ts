import { afterEach, describe, expect, it } from "vitest";

import {
  createTeacherSheetInviteToken,
  resolveTeacherSheetInviteToken
} from "../../src/lib/google/teacher-sheet-invite";

const ORIGINAL_NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

describe("teacher sheet invitation", () => {
  afterEach(() => {
    process.env.NEXTAUTH_SECRET = ORIGINAL_NEXTAUTH_SECRET;
  });

  it("binds an approval to the spreadsheet, target email, and a 15 minute expiry", () => {
    process.env.NEXTAUTH_SECRET = "invite-test-secret";
    const token = createTeacherSheetInviteToken({
      spreadsheetId: "sheet-123",
      inviterEmail: "owner@example.com",
      targetEmail: "new-teacher@example.com",
      now: new Date("2026-07-12T00:00:00.000Z")
    });

    expect(
      resolveTeacherSheetInviteToken(token, {
        spreadsheetId: "sheet-123",
        targetEmail: "new-teacher@example.com",
        now: new Date("2026-07-12T00:14:59.000Z")
      })
    ).toMatchObject({
      inviterEmail: "owner@example.com",
      targetEmail: "new-teacher@example.com",
      spreadsheetId: "sheet-123",
      expiresAt: "2026-07-12T00:15:00.000Z"
    });

    expect(() =>
      resolveTeacherSheetInviteToken(token, {
        spreadsheetId: "different-sheet",
        targetEmail: "new-teacher@example.com",
        now: new Date("2026-07-12T00:05:00.000Z")
      })
    ).toThrow("Invalid or expired teacher sheet invitation.");

    expect(() =>
      resolveTeacherSheetInviteToken(token, {
        spreadsheetId: "sheet-123",
        targetEmail: "other@example.com",
        now: new Date("2026-07-12T00:05:00.000Z")
      })
    ).toThrow("Invalid or expired teacher sheet invitation.");

    expect(() =>
      resolveTeacherSheetInviteToken(token, {
        spreadsheetId: "sheet-123",
        targetEmail: "new-teacher@example.com",
        now: new Date("2026-07-12T00:15:00.001Z")
      })
    ).toThrow("Invalid or expired teacher sheet invitation.");
  });
});
