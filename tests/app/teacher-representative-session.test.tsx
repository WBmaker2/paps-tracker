import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { importRequestStore, installTeacherApiFetch } from "./teacher-representative-fixture";

describe("teacher session and representative UI flows", () => {
  it("creates a one-class or two-class session from the teacher dashboard", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");
    const { getRequestStore } = await importRequestStore();

    render(
      <SessionForm
        classes={getRequestStore().listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5-1 Shuttle Run Practice" }
    });
    fireEvent.change(screen.getByLabelText("세션 유형"), {
      target: { value: "practice" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "single" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.click(screen.getByLabelText("왕복오래달리기"));
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("세션을 저장했습니다.");

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5학년 Sit And Reach Split" }
    });
    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "split" }
    });
    fireEvent.change(screen.getByLabelText("주 반"), {
      target: { value: "demo-class-5-1" }
    });
    fireEvent.change(screen.getByLabelText("보조 반"), {
      target: { value: "demo-class-5-2" }
    });
    fireEvent.click(screen.getByLabelText("앉아윗몸앞으로굽히기"));
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await waitFor(() => {
      expect(getRequestStore().listSessions()).toHaveLength(3);
    });

    expect(getRequestStore().listSessions().map((session) => session.classScope)).toEqual([
      "single",
      "single",
      "split"
    ]);
  });

  it("uses one shared event selector for split sessions", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");

    render(
      <SessionForm
        classes={(await importRequestStore()).getRequestStore().listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("운영 방식"), {
      target: { value: "split" }
    });

    expect(screen.getByLabelText("왕복오래달리기")).toBeInTheDocument();
  });

  it("lets a teacher choose the representative attempt", async () => {
    await installTeacherApiFetch();
    const { ResultTable } = await import("../../src/components/teacher/result-table");
    const { getRequestStore } = await importRequestStore();

    render(
      <ResultTable
        rows={[
          {
            recordId: "session-official-1:student-kim",
            sessionId: "session-official-1",
            studentId: "student-kim",
            studentName: "Kim",
            classLabel: "5-1",
            sessionName: "5-1 Sit And Reach",
            eventLabel: "앉아윗몸앞으로굽히기",
            unit: "cm",
            representativeAttemptId: null,
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                measurement: 18,
                createdAt: "2026-03-23T09:20:00.000Z"
              },
              {
                id: "attempt-2",
                attemptNumber: 2,
                measurement: 22,
                createdAt: "2026-03-23T09:22:00.000Z"
              }
            ]
          }
        ]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "2회차 대표값으로 선택" }));

    await screen.findByText("대표값이 업데이트되었습니다.");

    expect(
      getRequestStore().getAttemptRecord({
        sessionId: "session-official-1",
        studentId: "student-kim"
      }).representativeAttemptId
    ).toBe("attempt-2");
  });

  it("notifies the parent when the representative attempt changes", async () => {
    await installTeacherApiFetch();
    const { ResultTable } = await import("../../src/components/teacher/result-table");
    const onRepresentativeChange = vi.fn();

    render(
      <ResultTable
        rows={[
          {
            recordId: "session-official-1:student-kim",
            sessionId: "session-official-1",
            studentId: "student-kim",
            studentName: "Kim",
            classLabel: "5-1",
            sessionName: "5-1 Sit And Reach",
            eventLabel: "앉아윗몸앞으로굽히기",
            unit: "cm",
            representativeAttemptId: null,
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                measurement: 18,
                createdAt: "2026-03-23T09:20:00.000Z"
              },
              {
                id: "attempt-2",
                attemptNumber: 2,
                measurement: 22,
                createdAt: "2026-03-23T09:22:00.000Z"
              }
            ]
          }
        ]}
        onRepresentativeChange={onRepresentativeChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "2회차 대표값으로 선택" }));

    await waitFor(() => {
      expect(onRepresentativeChange).toHaveBeenCalledWith(
        "session-official-1:student-kim",
        "attempt-2"
      );
    });
  });
});
