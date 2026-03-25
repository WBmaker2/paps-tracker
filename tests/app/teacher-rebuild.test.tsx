import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("teacher rebuild UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows duplicate warnings in the result table", async () => {
    const { ResultTable } = await import("../../src/components/teacher/result-table");

    render(
      <ResultTable
        rows={[
          {
            recordId: "session-1:student-kim",
            sessionId: "session-1",
            studentId: "student-kim",
            studentName: "Kim",
            classLabel: "5-1",
            sessionName: "5-1 Shuttle Run",
            eventLabel: "왕복오래달리기",
            unit: "laps",
            representativeAttemptId: null,
            duplicateAttemptCount: 1,
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                measurement: 30,
                createdAt: "2026-03-24T09:00:00.000Z",
                clientSubmissionKey: "submit-1"
              },
              {
                id: "attempt-2",
                attemptNumber: 2,
                measurement: 30,
                createdAt: "2026-03-24T09:00:01.000Z",
                clientSubmissionKey: "submit-1"
              }
            ]
          }
        ]}
      />
    );

    expect(screen.getByText("같은 제출로 보이는 기록 1건이 있습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("학생별 시도 기록을 보고 대표 기록을 확정합니다.")
    ).toBeInTheDocument();
  });

  it("requests summary rebuild and clears the rebuild-needed banner on success", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        updatedTabs: ["학생요약", "공식평가요약"]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");

    render(
      <SyncStatusCard
        recordId="session-1:student-kim"
        status="failed"
        updatedAt="2026-03-24T09:10:00.000Z"
        message="Google Sheets API unavailable"
        rebuildSessionId="session-1"
        duplicateAttemptCount={1}
        initialRebuildNeeded
      />
    );

    expect(screen.getByText("요약 재계산 필요")).toBeInTheDocument();
    expect(
      screen.getByText("중복으로 보이는 제출 1건이 있어 요약을 다시 계산하는 것이 좋습니다.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "요약 재계산" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/results/rebuild", expect.objectContaining({
      method: "POST"
    }));
    expect(
      await screen.findByText("학생요약과 공식평가요약을 다시 정리했습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText("요약 재계산 필요")).not.toBeInTheDocument();
  });
});
