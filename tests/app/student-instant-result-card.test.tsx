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
        measurement: 17.2,
        createdAt: "2026-03-05T09:00:00.000Z",
        sessionId: "session-march",
        sessionName: "3월 5, 6학년 - 악력",
        sessionType: "practice",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: false
      },
      {
        id: "attempt-current",
        attemptNumber: 2,
        measurement: 18,
        createdAt: "2026-04-05T09:01:00.000Z",
        sessionId: "session-april",
        sessionName: "4월 5, 6학년 - 악력",
        sessionType: "official",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: true
      },
      {
        id: "attempt-april-first",
        attemptNumber: 1,
        measurement: 17.4,
        createdAt: "2026-04-05T09:02:00.000Z",
        sessionId: "session-april",
        sessionName: "4월 5, 6학년 - 악력",
        sessionType: "official",
        eventId: "grip-strength",
        academicYear: 2026,
        isCurrentSession: true
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

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("1번째 기록")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("17.2 kg")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("2번째 기록")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("17.4 kg")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("이번 기록")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("18 kg")).toBeInTheDocument();
  });
});
