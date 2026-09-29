import { describe, expect, it, vi } from "vitest";

import type { GoogleSheetsClient } from "../../src/lib/google/sheets-client";
import { parseRecordNote } from "../../src/lib/google/sheets-record-note";
import { updateGoogleSheetRecordSyncStatus } from "../../src/lib/google/sheet-source-write";
import { appendStudentSubmissionToSheet } from "../../src/lib/google/sheets-submit";
import { createClient } from "./sheets-submit-client";

describe("Google Sheets submission idempotency and concurrent cell patches", () => {
  it("serializes concurrent retries with the same key and appends one source row", async () => {
    const existingRows: string[][] = [];
    const baseClient = createClient();
    const client = {
      ...baseClient,
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'세션기록'!A2:U5000") {
          return existingRows.map((row) => [...row]);
        }

        return baseClient.readRange(_spreadsheetId, range);
      }),
      appendRows: vi.fn(async (_spreadsheetId: string, range: string, rows: string[][]) => {
        if (range === "'세션기록'!A:U") {
          existingRows.push(...rows.map((row) => [...row]));
        }

        return { spreadsheetId: "sheet-123" };
      })
    } satisfies GoogleSheetsClient;

    const input = {
      spreadsheetId: "sheet-123",
      sessionId: "session-1",
      studentId: "student-kim",
      measurement: 24,
      clientSubmissionKey: "same-submit-key",
      client
    };
    const results = await Promise.all([
      appendStudentSubmissionToSheet(input),
      appendStudentSubmissionToSheet(input)
    ]);
    const sourceAppends = vi
      .mocked(client.appendRows)
      .mock.calls.filter((call) => call[1] === "'세션기록'!A:U");

    expect(sourceAppends).toHaveLength(1);
    expect(existingRows).toHaveLength(1);
    expect(parseRecordNote(existingRows[0]?.[20])).toMatchObject({
      clientSubmissionKey: "same-submit-key"
    });
    expect(results.every((result) => result.ok)).toBe(true);
    expect(results[0]).toMatchObject({
      ok: true,
      result: { attempts: [expect.objectContaining({ clientSubmissionKey: "same-submit-key" })] }
    });
    expect(results[1]).toMatchObject({
      ok: true,
      result: { attempts: [expect.objectContaining({ clientSubmissionKey: "same-submit-key" })] }
    });
  });

  it("returns an existing same-key submission after session closure but rejects a new key", async () => {
    const storedAttempt = [
      "attempt-closed-retry", "session-1", "5-1 Sit And Reach", "2026", "2026-03-24",
      "공식", "1반형", "5-1", "1", "앉아윗몸앞으로굽히기", "cm", "student-kim",
      "Kim", "1", "24", "N", "", "2", "2026-03-24 09:10:00", "완료",
      "JSON:{\"clientSubmissionKey\":\"closed-retry-key\"}"
    ];
    const baseClient = createClient();
    const client: GoogleSheetsClient = {
      ...baseClient,
      readRange: vi.fn(async (spreadsheetId: string, range: string) => {
        if (range === "'세션기록'!A2:U5000") return [[...storedAttempt]];
        if (range === "'설정'!A2:F200") {
          const rows = await baseClient.readRange(spreadsheetId, range);
          const statusRow = rows.find((row) => row[0] === "__PAPS_SESSION_STATUS");
          if (statusRow) statusRow[2] = "N";
          return rows;
        }
        return baseClient.readRange(spreadsheetId, range);
      })
    };

    const retry = await appendStudentSubmissionToSheet({
      spreadsheetId: "sheet-123",
      sessionId: "session-1",
      studentId: "student-kim",
      measurement: 99,
      clientSubmissionKey: "closed-retry-key",
      client
    });
    expect(retry).toMatchObject({
      ok: true,
      result: { attempts: [expect.objectContaining({ id: "attempt-closed-retry", measurement: 24 })] }
    });
    expect(client.appendRows).not.toHaveBeenCalledWith(
      "sheet-123",
      "'세션기록'!A:U",
      expect.any(Array)
    );

    const newSubmission = await appendStudentSubmissionToSheet({
      spreadsheetId: "sheet-123",
      sessionId: "session-1",
      studentId: "student-kim",
      measurement: 25,
      clientSubmissionKey: "closed-new-key",
      client
    });
    expect(newSubmission).toMatchObject({ ok: false, error: "Session is closed." });
    expect(client.appendRows).not.toHaveBeenCalledWith(
      "sheet-123",
      "'세션기록'!A:U",
      expect.any(Array)
    );
  });

  it("preserves existing and newly submitted rows when a sync-status cell update overlaps a submit", async () => {
    const originalRow = [
      "old-attempt",
      "session-1",
      "5-1 Sit And Reach",
      "2026",
      "2026-03-23",
      "공식",
      "1반형",
      "5-1",
      "1",
      "앉아윗몸앞으로굽히기",
      "cm",
      "student-kim",
      "Kim",
      "1",
      "20",
      "N",
      "",
      "1",
      "2026-03-23 09:00:00",
      "대기",
      "JSON:{\"clientSubmissionKey\":\"old-key\"}"
    ];
    const recordRows = [originalRow];
    const baseClient = createClient();
    const client: GoogleSheetsClient = {
      ...baseClient,
      readRange: vi.fn(async (spreadsheetId: string, range: string) => {
        if (range === "'세션기록'!A2:U5000") {
          return recordRows.map((row) => [...row]);
        }

        return baseClient.readRange(spreadsheetId, range);
      }),
      appendRows: vi.fn(async (_spreadsheetId, range, values) => {
        if (range === "'세션기록'!A:U") {
          recordRows.push(...values.map((row) => row.map((cell) => String(cell ?? ""))));
        }

        return { spreadsheetId: "sheet-123" };
      }),
      updateRange: vi.fn(async (_spreadsheetId, range, values) => {
        const match = range.match(/'세션기록'!T(\d+)$/);

        if (match) {
          recordRows[Number(match[1]) - 2]![19] = String(values[0]?.[0] ?? "");
        }

        return { spreadsheetId: "sheet-123" };
      })
    };

    const [submitResult] = await Promise.all([
      appendStudentSubmissionToSheet({
        spreadsheetId: "sheet-123",
        sessionId: "session-1",
        studentId: "student-kim",
        measurement: 24,
        clientSubmissionKey: "new-key",
        client
      }),
      updateGoogleSheetRecordSyncStatus({
        spreadsheetId: "sheet-123",
        client,
        sessionId: "session-1",
        studentId: "student-kim",
        statusLabel: "완료"
      })
    ]);

    expect(submitResult.ok).toBe(true);
    expect(recordRows).toHaveLength(2);
    expect(recordRows[0]?.[0]).toBe("old-attempt");
    expect(recordRows[0]?.[14]).toBe("20");
    expect(recordRows[0]?.[19]).toBe("완료");
    expect(parseRecordNote(recordRows[0]?.[20])).toMatchObject({ clientSubmissionKey: "old-key" });
    expect(recordRows[1]?.[14]).toBe("24");
    expect(parseRecordNote(recordRows[1]?.[20])).toMatchObject({ clientSubmissionKey: "new-key" });
  });
});
