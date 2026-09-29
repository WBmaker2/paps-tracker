import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { getRequestStore, resetRequestStore } from "../../src/lib/store/paps-memory-store";
import { buildStudentSeed, installStudentApiFetch, jsonRequest, renderStudentSessionPage } from "./student-session-test-helpers";

describe("student session flow", () => {
  beforeEach(() => resetRequestStore(buildStudentSeed()));
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.doUnmock("../../src/lib/paps/grade");
    resetRequestStore();
  });

  it("shows only a name picker before input", async () => {
    await renderStudentSessionPage("session-open-single");

    expect(screen.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "교사 관리 화면" })).toBeInTheDocument();
    expect(screen.getByText("이름을 선택하세요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kim" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Park" })).toBeInTheDocument();
    expect(screen.queryByLabelText("앉아윗몸앞으로굽히기 기록")).not.toBeInTheDocument();
    expect(screen.queryByText("즉시 결과")).not.toBeInTheDocument();
  });

  it("renders three heart-rate inputs for a step-test session and stores the derived PEI score", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-step-test");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("심박수(1분~1분30초)"), {
      target: { value: "50" }
    });
    fireEvent.change(screen.getByLabelText("심박수(2분~2분30초)"), {
      target: { value: "50" }
    });
    fireEvent.change(screen.getByLabelText("심박수(3분~3분30초)"), {
      target: { value: "49" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");
    expect(screen.getByText("회복심박수 50 / 50 / 49회")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        getRequestStore()
          .getAttemptRecord({
            sessionId: "session-step-test",
            studentId: "student-kim"
          })
          .attempts.at(-1)?.measurement
      ).toBe(60.5);
    });
  });

  it("renders comprehensive flexibility toggles and stores the summed score", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-flexibility");

    fireEvent.click(screen.getByRole("button", { name: "Choi" }));
    fireEvent.click(screen.getByLabelText("어깨 오른쪽 성공"));
    fireEvent.click(screen.getByLabelText("어깨 왼쪽 성공"));
    fireEvent.click(screen.getByLabelText("몸통 오른쪽 성공"));
    fireEvent.click(screen.getByLabelText("몸통 왼쪽 실패"));
    fireEvent.click(screen.getByLabelText("옆구리 오른쪽 실패"));
    fireEvent.click(screen.getByLabelText("옆구리 왼쪽 실패"));
    fireEvent.click(screen.getByLabelText("하체 오른쪽 성공"));
    fireEvent.click(screen.getByLabelText("하체 왼쪽 성공"));
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Choi 학생 결과");
    expect(screen.getByText("어깨 2점 · 몸통 1점 · 옆구리 0점 · 하체 2점")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        getRequestStore()
          .getAttemptRecord({
            sessionId: "session-flexibility",
            studentId: "student-choi"
          })
          .attempts.at(-1)?.measurement
      ).toBe(5);
    });
  });

  it("submits an official grade 4 standing long jump attempt", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-grade4-jump");

    fireEvent.click(screen.getByRole("button", { name: "Choi" }));
    fireEvent.change(screen.getByLabelText("제자리멀리뛰기 기록"), {
      target: { value: "171" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Choi 학생 결과");
    expect(screen.getByText("제자리멀리뛰기")).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("이번 기록 기준 등급:"))).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("1등급"))).toBeInTheDocument();

    await waitFor(() => {
      expect(
        getRequestStore().getAttemptRecord({
          sessionId: "session-grade4-jump",
          studentId: "student-choi"
        }).attempts
      ).toHaveLength(1);
    });
  });

  it("submits a new attempt for a one-class session", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "24" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");

    await waitFor(() => {
      expect(
        getRequestStore().getAttemptRecord({
          sessionId: "session-open-single",
          studentId: "student-kim"
        }).attempts
      ).toHaveLength(3);
    });

    expect(
      getRequestStore()
        .getAttemptRecord({
          sessionId: "session-open-single",
          studentId: "student-kim"
        })
      .attempts.at(-1)?.measurement
    ).toBe(24);
  });

  it("shows same-event history from previous sessions after submit", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "24" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");

    expect(screen.getByText("3월 앉아윗몸앞으로굽히기 · 연습")).toBeInTheDocument();
    expect(screen.getAllByText("5-1 Official Sit And Reach · 공식").length).toBeGreaterThan(0);
    expect(screen.getByText("16 cm")).toBeInTheDocument();
    expect(screen.getAllByText("이번 기록")).toHaveLength(2);
    expect(screen.getByText("직전 대비 +3 cm")).toBeInTheDocument();
  });

  it("renders bilateral grip-strength inputs with side-specific labels", async () => {
    await renderStudentSessionPage("session-grip");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));

    expect(screen.getByLabelText("오른쪽 악력")).toBeInTheDocument();
    expect(screen.getByLabelText("왼쪽 악력")).toBeInTheDocument();
    expect(screen.queryByLabelText("악력 기록")).not.toBeInTheDocument();
  });

  it("validates that both grip-strength sides are required", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-grip");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("오른쪽 악력"), {
      target: { value: "17.5" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("양쪽 악력 값을 모두 입력해 주세요.");
    const attempts = getRequestStore().getAttemptRecord({
      sessionId: "session-grip",
      studentId: "student-kim"
    }).attempts;

    expect(attempts).toHaveLength(0);
  });

  it("stores grip-strength as max measurement and bilateral detail, and prefills values in edit mode", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-grip");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("오른쪽 악력"), {
      target: { value: "18.4" }
    });
    fireEvent.change(screen.getByLabelText("왼쪽 악력"), {
      target: { value: "17.4" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");

    const submitted = getRequestStore().getAttemptRecord({
      sessionId: "session-grip",
      studentId: "student-kim"
    }).attempts.at(-1);

    expect(submitted?.measurement).toBe(18.4);
    expect(submitted?.detail).toEqual({
      kind: "grip-strength",
      right: 18.4,
      left: 17.4
    });

    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }));

    const editRightInput = screen.getByLabelText("오른쪽 악력") as HTMLInputElement;
    const editLeftInput = screen.getByLabelText("왼쪽 악력") as HTMLInputElement;

    expect(editRightInput.value).toBe("18.4");
    expect(editLeftInput.value).toBe("17.4");

    fireEvent.change(editRightInput, {
      target: { value: "17" }
    });
    fireEvent.change(editLeftInput, {
      target: { value: "19.2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => {
      const latest = getRequestStore().getAttemptRecord({
        sessionId: "session-grip",
        studentId: "student-kim"
      }).attempts.at(-1);

      expect(latest?.measurement).toBe(19.2);
      expect(latest?.detail).toEqual({
        kind: "grip-strength",
        right: 17,
        left: 19.2
      });
      expect(
        getRequestStore().getAttemptRecord({
          sessionId: "session-grip",
          studentId: "student-kim"
        }).attempts
      ).toHaveLength(1);
    });
  });

  it("allows editing the latest submitted attempt without adding another attempt", async () => {
    await installStudentApiFetch();
    await renderStudentSessionPage("session-open-single");

    fireEvent.click(screen.getByRole("button", { name: "Kim" }));
    fireEvent.change(screen.getByLabelText("앉아윗몸앞으로굽히기 기록"), {
      target: { value: "24" }
    });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));

    await screen.findByText("Kim 학생 결과");
    fireEvent.click(screen.getByRole("button", { name: "방금 기록 수정" }));

    const editInput = screen.getByLabelText("앉아윗몸앞으로굽히기 기록") as HTMLInputElement;

    expect(editInput.value).toBe("24");

    fireEvent.change(editInput, {
      target: { value: "26" }
    });
    fireEvent.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => {
      const attempts = getRequestStore().getAttemptRecord({
        sessionId: "session-open-single",
        studentId: "student-kim"
      }).attempts;

      expect(attempts).toHaveLength(3);
      expect(attempts.at(-1)?.measurement).toBe(26);
    });
    expect(screen.queryByRole("button", { name: "수정 저장" })).not.toBeInTheDocument();
    expect(screen.getAllByText("26 cm").length).toBeGreaterThan(0);
  });

});
