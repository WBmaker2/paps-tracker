import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { buildSummaryWorkbook } from "../../src/lib/google/summary-export-xlsx";

describe("summary xlsx export", () => {
  it("builds a workbook with student and official summary sheets", () => {
    const buffer = buildSummaryWorkbook([
      {
        tabName: "학생요약",
        header: ["학생ID", "이름", "학생표시문구"],
        rows: [["student-kim", "홍길동", "지난 기록 대비 +2cm"]]
      },
      {
        tabName: "공식평가요약",
        header: ["학생ID", "이름", "공식등급"],
        rows: [["student-kim", "홍길동", 3]]
      }
    ]);

    const workbook = XLSX.read(buffer, {
      type: "buffer"
    });

    expect(workbook.SheetNames).toEqual(["학생요약", "공식평가요약"]);
    expect(workbook.Sheets["학생요약"]?.B2?.v).toBe("홍길동");
    expect(workbook.Sheets["학생요약"]?.C2?.v).toBe("지난 기록 대비 +2cm");
    expect(workbook.Sheets["공식평가요약"]?.C2?.v).toBe(3);
  });
});
