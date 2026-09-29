import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";

import {
  FOUR_FACTOR_ROUND_HEADER,
  FOUR_FACTOR_ROUND_TAB_NAME
} from "../../src/lib/google/four-factor-round-sheet";
import { validatePapsGoogleSheetTemplate } from "../../src/lib/google/sheets-schema";

const { requireTeacherRouteSession } = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn()
}));
vi.mock("../../src/lib/teacher-auth", () => ({ requireTeacherRouteSession }));

describe("blank PAPS template download route", () => {
  it("downloads an empty current-schema workbook that passes the connection schema validator", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: { email: "teacher@example.com" }
    });
    const route = await import("../../app/api/google-sheet/template/download/route");
    const response = await route.GET();
    const bytes = Buffer.from(await response.arrayBuffer());
    const workbook = XLSX.read(bytes, { type: "buffer" });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect(response.headers.get("content-disposition")).toContain("paps-empty-template-v0.2.xlsx");
    expect(workbook.SheetNames).toEqual([
      "설정",
      "학생명단",
      "세션기록",
      "학생요약",
      "공식평가요약",
      "오류로그",
      "수정로그",
      FOUR_FACTOR_ROUND_TAB_NAME
    ]);

    const cellsByTab = new Map(
      workbook.SheetNames.map((name) => [
        name,
        XLSX.utils.sheet_to_json(workbook.Sheets[name]!, {
          header: 1,
          blankrows: true,
          defval: "",
          raw: false
        }) as string[][]
      ])
    );
    const settingsRows = cellsByTab.get("설정") ?? [];
    expect(settingsRows[0]).toEqual(["항목", "값", "설명", "", "사용 탭", "역할"]);
    expect(settingsRows[9]?.[0]).toBe("시트 템플릿 버전");
    expect(settingsRows[9]?.[1]).toBe("v0.2-four-factor-round");
    expect(cellsByTab.get(FOUR_FACTOR_ROUND_TAB_NAME)?.[0]).toEqual(Array.from(FOUR_FACTOR_ROUND_HEADER));
    for (const tabName of workbook.SheetNames.filter((name) => name !== "설정")) {
      expect(cellsByTab.get(tabName)).toHaveLength(1);
    }

    const client = {
      getSpreadsheet: async () => ({
        sheets: workbook.SheetNames.map((title, sheetId) => ({ properties: { title, sheetId } }))
      }),
      readRange: async (_spreadsheetId: string, range: string) => {
        const tabName = range.split("!")[0]?.replaceAll("'", "") ?? "";
        const tabRows = cellsByTab.get(tabName) ?? [];
        return range.includes("A1:C20") ? tabRows : tabRows.slice(0, 1);
      }
    };
    const validation = await validatePapsGoogleSheetTemplate(client as never, "downloaded-empty-file");
    expect(validation.templateVersion).toBe("v0.2-four-factor-round");
  });
});
