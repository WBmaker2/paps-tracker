import { describe, expect, it } from "vitest";

import {
  assertGoogleSheetTabsMatchPrototype,
  parseGoogleSheetTabPayloads
} from "../../src/lib/google/sheet-tab-contract";
import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "../../src/lib/google/template";

describe("Google Sheet tab contract", () => {
  it("normalizes nullable header values while preserving scalar row values", () => {
    expect(
      parseGoogleSheetTabPayloads([
        {
          tabName: "Results",
          header: ["name", null, 3],
          rows: [["Kim", 12, true]]
        }
      ])
    ).toEqual([
      {
        tabName: "Results",
        header: ["name", "", "3"],
        rows: [["Kim", 12, true]]
      }
    ]);
  });

  it("rejects prototype contract mismatches by tab order or header", () => {
    const tabs = PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab) => ({
      tabName: tab.tabName,
      header: [...tab.header],
      rows: []
    }));

    tabs[1] = {
      ...tabs[1]!,
      tabName: "학생명단-변경"
    };

    expect(() => assertGoogleSheetTabsMatchPrototype(tabs)).toThrow(
      "Manual Google Sheet tabs must match the prototype tab order and names."
    );
  });
});
