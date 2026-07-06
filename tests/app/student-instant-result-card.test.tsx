import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstantResultCard } from "../../src/components/student/instant-result-card";
import type { PAPSStudentEventHistoryAttempt } from "../../src/lib/paps/types";

describe("student instant result card", () => {
  it("shows cumulative attempts in measurement order and compares the current result with the immediately previous attempt", () => {
    const historyAttempts: PAPSStudentEventHistoryAttempt[] = [
      {
        id: "attempt-march",
        attemptNumber: 1,
        measurement: 18,
        createdAt: "2026-03-05T09:00:00.000Z",
        sessionId: "session-march",
        sessionName: "3월 5, 6학년 - 악력",
        sessionType: "practice",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: false,
        detail: {
          kind: "grip-strength",
          right: 18,
          left: 17.4
        }
      },
      {
        id: "attempt-current",
        attemptNumber: 2,
        measurement: 18,
        createdAt: "2026-04-05T09:02:00.000Z",
        sessionId: "session-april",
        sessionName: "4월 5, 6학년 - 악력",
        sessionType: "official",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: true,
        detail: {
          kind: "grip-strength",
          right: 16.4,
          left: 18.6
        }
      },
      {
        id: "attempt-april-first",
        attemptNumber: 1,
        measurement: 17.4,
        createdAt: "2026-04-05T09:01:00.000Z",
        sessionId: "session-april",
        sessionName: "4월 5, 6학년 - 악력",
        sessionType: "official",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: true,
        detail: {
          kind: "grip-strength",
          right: 19.8,
          left: 16.4
        }
      }
    ];

    render(
      <InstantResultCard
        studentName="황세준"
        sessionType="official"
        eventId="grip-strength"
        eventLabel="악력"
        unit="kg"
        attempts={[
          historyAttempts[2]!,
          historyAttempts[1]!
        ]}
        historyAttempts={historyAttempts}
        betterDirection="higher"
        latestOfficialGrade={4}
      />
    );

    expect(screen.getByText("직전 대비 +0.6 kg")).toBeInTheDocument();
    expect(
      screen.getByText((content) =>
        content.includes("총 0 kg 오르내림이 있었고, 직전 기록보다 +0.6 kg 좋아졌습니다.")
      )
    ).toBeInTheDocument();
    expect(screen.getByText("오른손·왼손 추이")).toBeInTheDocument();
    expect(screen.getByText("오른손")).toBeInTheDocument();
    expect(screen.getByText("왼손")).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes("3월")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content) => content.includes("이번")).length).toBeGreaterThan(0);
    expect(screen.getByText("오른쪽 대표 19.8kg · 왼쪽 대표 18.6kg")).toBeInTheDocument();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("1번째 기록")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("18 kg")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("2번째 기록")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("17.4 kg")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("이번 기록")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("18 kg")).toBeInTheDocument();
  });

  it("shows cumulative growth summary and chart labels for non-grip events", () => {
    const historyAttempts: PAPSStudentEventHistoryAttempt[] = [
      {
        id: "attempt-march-sit-and-reach",
        attemptNumber: 1,
        measurement: 16,
        createdAt: "2026-03-02T09:00:00.000Z",
        sessionId: "session-march",
        sessionName: "3월 측정",
        sessionType: "practice",
        eventId: "sit-and-reach",
        academicYear: 2026,
        isCurrentSession: false,
        detail: null
      },
      {
        id: "attempt-april-sit-and-reach",
        attemptNumber: 1,
        measurement: 21,
        createdAt: "2026-04-02T09:00:00.000Z",
        sessionId: "session-april",
        sessionName: "4월 측정",
        sessionType: "practice",
        eventId: "sit-and-reach",
        academicYear: 2026,
        isCurrentSession: false,
        detail: null
      },
      {
        id: "attempt-july-sit-and-reach",
        attemptNumber: 1,
        measurement: 24,
        createdAt: "2026-07-02T09:00:00.000Z",
        sessionId: "session-july",
        sessionName: "7월 측정",
        sessionType: "official",
        eventId: "sit-and-reach",
        academicYear: 2026,
        isCurrentSession: true,
        detail: null
      }
    ];

    render(
      <InstantResultCard
        studentName="김수진"
        sessionType="official"
        eventId="sit-and-reach"
        eventLabel="싯앤리치"
        unit="cm"
        attempts={[historyAttempts[2]!]}
        historyAttempts={historyAttempts}
        betterDirection="higher"
        latestOfficialGrade={4}
      />
    );

    expect(
      screen.getByText(
        "3월 측정 16 cm에서 7월 측정 24 cm까지 총 +8 cm 변화했고, 직전 기록보다 +3 cm 좋아졌습니다."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("개인 누적 추이")).toBeInTheDocument();
    expect(screen.getByText("이번 기록 기준 등급: 4등급")).toBeInTheDocument();
    expect(screen.getByText("지난 세션까지 이어서 봅니다.")).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes("3월")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content) => content.includes("4월")).length).toBeGreaterThan(0);
    expect(screen.getAllByText((content) => content.includes("이번")).length).toBeGreaterThan(0);
  });
});
