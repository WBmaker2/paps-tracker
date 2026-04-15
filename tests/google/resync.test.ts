import { describe, expect, it, vi } from "vitest";

import { resyncGoogleSheet } from "../../src/lib/google/resync";
import type { GoogleSheetTabPayload } from "../../src/lib/google/sheets";

const tabs: GoogleSheetTabPayload[] = [
  {
    tabName: "설정",
    header: ["항목", "값"],
    rows: [["학교명", "Demo Elementary"]]
  },
  {
    tabName: "학생요약",
    header: ["학생", "등급"],
    rows: [["Kim", "1"]]
  }
];

describe("Google Sheet resync", () => {
  it("writes all requested tabs when dryRun is false", async () => {
    const updateRange = vi.fn(async () => ({
      updates: {
        updatedCells: 2
      }
    }));

    const result = await resyncGoogleSheet(
      {
        spreadsheetId: "sheet-123",
        tabs,
        triggeredByTeacherEmail: "teacher@example.com",
        dryRun: false
      },
      {
        updateRange
      } as never
    );

    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      updatedTabs: ["설정", "학생요약"],
      request: {
        spreadsheetId: "sheet-123"
      }
    });
    expect(updateRange).toHaveBeenNthCalledWith(
      1,
      "sheet-123",
      "'설정'!A1",
      [
        ["항목", "값"],
        ["학교명", "Demo Elementary"]
      ]
    );
    expect(updateRange).toHaveBeenNthCalledWith(
      2,
      "sheet-123",
      "'학생요약'!A1",
      [
        ["학생", "등급"],
        ["Kim", "1"]
      ]
    );
  });

  it("returns a preview without writing when dryRun is true", async () => {
    const updateRange = vi.fn();

    const result = await resyncGoogleSheet(
      {
        spreadsheetId: "sheet-123",
        tabs,
        triggeredByTeacherEmail: "teacher@example.com",
        dryRun: true
      },
      {
        updateRange
      } as never
    );

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      updatedTabs: [],
      request: {
        spreadsheetId: "sheet-123"
      }
    });
    expect(updateRange).not.toHaveBeenCalled();
  });
});
