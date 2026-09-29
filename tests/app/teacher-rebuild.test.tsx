import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("teacher rebuild UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks and disables duplicate raw attempts in the result table", async () => {
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

    expect(screen.getByText("원본 시도 중 중복 제출 1건을 확인했습니다. 원본은 보존됩니다.")).toBeInTheDocument();
    expect(screen.getByText("같은 제출의 중복 원본 · 대표값 선택 불가")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2회차 대표값으로 선택" })).toBeDisabled();
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

    expect(screen.getByText("요약표 갱신 필요 · 원본 저장 상태와 별도입니다.")).toBeInTheDocument();
    expect(
      screen.getByText("원본 중복 제출 1건을 보존하고 있습니다.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "요약 재계산" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/results/rebuild", expect.objectContaining({
      method: "POST"
    }));
    expect(
      await screen.findByText("학생요약과 공식평가요약을 다시 정리했습니다.")
    ).toBeInTheDocument();
    expect(screen.queryByText("요약표 갱신 필요 · 원본 저장 상태와 별도입니다.")).not.toBeInTheDocument();
  });
});
