import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecordForm } from "../../src/components/student/record-form";
import { SplitSessionView } from "../../src/components/student/split-session-view";
import { getOrCreateClientSubmissionKey } from "../../src/components/student/submission-intent";

vi.mock("../../src/components/student/instant-result-card", () => ({
  InstantResultCard: () => <div>결과 카드</div>
}));
vi.mock("../../src/components/student/four-factor-progress-card", () => ({
  FourFactorProgressCard: () => null
}));
vi.mock("../../src/components/student/student-session-navigation", () => ({
  StudentSessionNavigation: () => null
}));

afterEach(() => vi.unstubAllGlobals());

describe("student recording flow UX", () => {
  it("links validation errors to the field and focuses that field", async () => {
    const onSubmit = vi.fn();
    render(
      <RecordForm
        studentId="student-1"
        eventId="50m-run"
        studentName="민수"
        eventLabel="50m 달리기"
        unit="seconds"
        measurementConstraints={{ min: 1, max: 30, precision: 2 }}
        isSubmitting={false}
        errorMessage={null}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));
    const input = screen.getByLabelText("50m 달리기 기록");
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby");
    expect(screen.getByRole("alert")).toHaveTextContent("숫자 기록을 입력해 주세요.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("opens the form for a name and reuses retry keys until the input changes", async () => {
    const requests: Array<Record<string, unknown>> = [];
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      call += 1;
      if (call < 2) {
        return { ok: false, json: async () => ({ error: "temporary failure" }) };
      }
      return {
        ok: true,
        json: async () => ({
          result: {
            student: { id: "student-1", name: "민수" },
            attempts: [],
            latestOfficialGrade: null,
            summaryWarning: "internal detail that should not be exposed"
          }
        })
      };
    }));

    render(
      <SplitSessionView
        sessionId="session-1"
        sessionType="practice"
        classScope="single"
        eventId="50m-run"
        eventLabel="50m 달리기"
        unit="seconds"
        betterDirection="lower"
        measurementConstraints={{ min: 1, max: 30, precision: 2 }}
        classSections={[{
          classId: "class-1",
          label: "4-1",
          students: Array.from({ length: 30 }, (_, index) => ({
            id: `student-${index + 1}`,
            name: index === 0 ? "민수" : `학생 ${index + 1}`
          }))
        }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "민수" }));
    const input = await screen.findByLabelText("50m 달리기 기록");
    await waitFor(() => expect(input).toHaveFocus());
    fireEvent.change(input, { target: { value: "8.25" } });
    const submit = screen.getByRole("button", { name: "기록 제출" });
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("기록을 저장하지 못했어요"));
    await waitFor(() => expect(submit).toBeEnabled());
    fireEvent.click(submit);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].clientSubmissionKey).toBe(requests[1].clientSubmissionKey);

    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent("기록은 저장됐어요. 요약 갱신에 문제가 있어 선생님 확인이 필요합니다.");
    expect(screen.queryByText("internal detail that should not be exposed")).not.toBeInTheDocument();
  });

  it("starts a new submission intent when the recorded value changes", () => {
    const first = getOrCreateClientSubmissionKey(null, "8.25", () => "key-1");
    const retry = getOrCreateClientSubmissionKey(first, "8.25", () => "key-2");
    const changed = getOrCreateClientSubmissionKey(retry, "8.20", () => "key-3");
    expect(retry.key).toBe("key-1");
    expect(changed.key).toBe("key-3");
  });
});
