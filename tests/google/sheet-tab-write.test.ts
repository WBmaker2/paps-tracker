import { describe, expect, it, vi } from "vitest";

import {
  executeGoogleSheetTabWrite,
  prepareGoogleSheetTabWrite,
  prepareGoogleSheetWriteRequest,
  writeGoogleSheetTabs
} from "../../src/lib/google/sheet-tab-write";
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
    rows: [["Kim", 1]]
  }
];

describe("Google Sheet tab writes", () => {
  it("prepares a tab update request from payload rows", () => {
    expect(prepareGoogleSheetTabWrite(tabs[0]!)).toEqual({
      tabName: "설정",
      range: "'설정'!A1",
      values: [
        ["항목", "값"],
        ["학교명", "Demo Elementary"]
      ]
    });
  });

  it("prepares a workbook write request for all tabs", () => {
    expect(prepareGoogleSheetWriteRequest("sheet-123", tabs)).toEqual({
      spreadsheetId: "sheet-123",
      valueInputOption: "USER_ENTERED",
      data: [
        {
          tabName: "설정",
          range: "'설정'!A1",
          values: [
            ["항목", "값"],
            ["학교명", "Demo Elementary"]
          ]
        },
        {
          tabName: "학생요약",
          range: "'학생요약'!A1",
          values: [
            ["학생", "등급"],
            ["Kim", "1"]
          ]
        }
      ]
    });
  });

  it("returns a dry-run write preview without mutating Sheets", async () => {
    const result = await writeGoogleSheetTabs({
      spreadsheetId: "sheet-123",
      tabs,
      dryRun: true
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: true,
      updatedTabs: [],
      request: {
        spreadsheetId: "sheet-123"
      }
    });
  });

  it("executes each tab update in order when dryRun is false", async () => {
    const updateRange = vi.fn(async () => ({
      updates: {
        updatedCells: 2
      }
    }));

    const result = await executeGoogleSheetTabWrite({
      spreadsheetId: "sheet-123",
      tabs,
      client: {
        updateRange
      } as never,
      dryRun: false
    });

    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      updatedTabs: ["설정", "학생요약"]
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
});
