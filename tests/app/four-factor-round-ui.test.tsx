import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeacherSessionWorkspace } from "../../src/components/teacher/teacher-session-workspace";
import { FourFactorRoundResultPanel } from "../../src/components/teacher/four-factor-round-result-panel";
import { FourFactorProgressCard } from "../../src/components/student/four-factor-progress-card";
import { SessionGroupView } from "../../src/components/student/session-group-view";
import { SessionStatusList } from "../../src/components/teacher/session-status-list";
import { adaptRoundResult } from "../../src/components/teacher/four-factor-round-adapter";
import type { PAPSStudentRoundResult } from "../../src/lib/paps/types";

const classes = [
  {
    id: "class-5-1",
    schoolId: "school-1",
    academicYear: 2026,
    gradeLevel: 5 as const,
    classNumber: 1,
    label: "5-1",
    active: true
  }
];

const result = {
  roundId: "round-1",
  studentId: "student-1",
  studentName: "김학생",
  status: "ready" as const,
  revision: 0,
  factors: {
    "cardiorespiratory-endurance": { factorId: "cardiorespiratory-endurance" as const, eventLabel: "왕복오래달리기", measurement: 42, unit: "laps", factorScore: 16 },
    flexibility: { factorId: "flexibility" as const, eventLabel: "앉아윗몸앞으로굽히기", measurement: 18, unit: "cm", factorScore: 15 },
    "strength-endurance": { factorId: "strength-endurance" as const, eventLabel: "윗몸말아올리기", measurement: 30, unit: "reps", factorScore: 14 },
    power: { factorId: "power" as const, eventLabel: "50m달리기", measurement: 9.2, unit: "seconds", factorScore: 13 }
  },
  fourFactorSubtotal: 58,
  normalizedScore: 72.5,
  fourFactorGrade: 2 as const
};

describe("four-factor round UI", () => {
  const progress = (completed: number) => ({
    roundId: "round-1",
    factors: [
      { factorId: "cardiorespiratory-endurance" as const, eventLabel: "왕복오래달리기", complete: completed >= 1 },
      { factorId: "flexibility" as const, eventLabel: "앉아윗몸앞으로굽히기", complete: completed >= 2 },
      { factorId: "strength-endurance" as const, eventLabel: "윗몸말아올리기", complete: completed >= 3 },
      { factorId: "power" as const, eventLabel: "50m달리기", complete: completed >= 4 }
    ],
    roundProgress: { completed, total: 4 as const, nextFactorId: "flexibility" as const, nextEventLabel: "앉아윗몸앞으로굽히기" }
  });

  const groupSessions = [
    {
      sessionId: "session-cardio",
      sessionName: "심폐지구력",
      sessionType: "official" as const,
      classScope: "single" as const,
      eventId: "shuttle-run" as const,
      eventLabel: "왕복오래달리기",
      unit: "laps",
      betterDirection: "higher" as const,
      isOpen: true,
      factorId: "cardiorespiratory-endurance" as const,
      measurementConstraints: { min: 0, max: 150, precision: 0 },
      classSections: [{ classId: "class-5-1", label: "5-1", students: [{ id: "student-a", name: "학생 A" }, { id: "student-b", name: "학생 B" }] }]
    },
    {
      sessionId: "session-flexibility",
      sessionName: "유연성",
      sessionType: "official" as const,
      classScope: "single" as const,
      eventId: "sit-and-reach" as const,
      eventLabel: "앉아윗몸앞으로굽히기",
      unit: "cm",
      betterDirection: "higher" as const,
      isOpen: true,
      factorId: "flexibility" as const,
      measurementConstraints: { min: -40, max: 50, precision: 1 },
      classSections: [{ classId: "class-5-1", label: "5-1", students: [{ id: "student-a", name: "학생 A" }, { id: "student-b", name: "학생 B" }] }]
    }
  ];

  it("requires one event per factor and sends an official round request without fat/BMI or client rule authority", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        sessions: [{ id: "session-1", name: "4요인", eventId: "shuttle-run" }],
        studentSessionUrl: "/session-group/group-1"
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeacherSessionWorkspace classes={classes} sessions={[]} defaultTeacherId="teacher-1" defaultSchoolId="school-1" />
    );

    fireEvent.click(screen.getByLabelText("4요인 평가 회차"));
    fireEvent.change(screen.getByLabelText("세션 이름"), { target: { value: "1회차 체력 평가" } });
    fireEvent.click(screen.getByLabelText("왕복오래달리기"));
    fireEvent.click(screen.getByLabelText("앉아윗몸앞으로굽히기"));
    fireEvent.click(screen.getByLabelText("윗몸말아올리기"));
    fireEvent.click(screen.getByLabelText("50m달리기"));
    fireEvent.click(screen.getByRole("button", { name: "4요인 평가 회차 저장" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0]!;
    const body = JSON.parse(String(init?.body));
    expect(body.sessionType).toBe("official");
    expect(body.roundType).toBe("regular");
    expect(body.roundNumber).toBe(1);
    expect(Object.keys(body.selectedEventsByFactor)).toHaveLength(4);
    expect(body).not.toHaveProperty("bodyFat");
    expect(body).not.toHaveProperty("bmi");
    expect(body).not.toHaveProperty("ruleVersion");
    expect(body).not.toHaveProperty("ruleSource");
    expect(body).not.toHaveProperty("teacherId");
    expect(body).not.toHaveProperty("schoolId");
    expect((init?.headers as Headers).get("Idempotency-Key")).toBeTruthy();
  });

  it("shows result statuses and finalizes a ready student", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          roundId: "round-1",
          studentId: "student-1",
          revision: 1,
          previousRevision: null,
          status: "finalized",
          studentSnapshot: { name: "김학생", sex: "female", gradeLevel: 5, classId: "class-5-1", classNumber: 1, studentNumber: 1 },
          factors: {
            "cardiorespiratory-endurance": { factorId: "cardiorespiratory-endurance", eventId: "shuttle-run", sessionId: "s1", representativeAttemptId: "a1", measurement: 42, factorScore: 16 },
            flexibility: { factorId: "flexibility", eventId: "sit-and-reach", sessionId: "s2", representativeAttemptId: "a2", measurement: 18, factorScore: 15 },
            "strength-endurance": { factorId: "strength-endurance", eventId: "curl-up", sessionId: "s3", representativeAttemptId: "a3", measurement: 30, factorScore: 14 },
            power: { factorId: "power", eventId: "fifty-meter-run", sessionId: "s4", representativeAttemptId: "a4", measurement: 9.2, factorScore: 13 }
          },
          fourFactorSubtotal: 58,
          normalizedScore: 72.5,
          fourFactorGrade: 2,
          ruleVersion: "server",
          ruleSource: "server",
          sourceFingerprint: "fingerprint",
          calculatedAt: null,
          finalizedAt: "2026-08-26T00:00:00.000Z",
          finalizedBy: "teacher-1"
        },
        replayed: false
      })
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<FourFactorRoundResultPanel roundId="round-1" results={[result]} />);

    expect(screen.getByText("확정 준비")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "4요인 결과 확정" }));
    await screen.findByText("김학생 학생의 4요인 결과를 확정했습니다.");
    expect(screen.getByText("확정됨")).toBeInTheDocument();
    expect(screen.getByText("왕복오래달리기 · 42 laps")).toBeInTheDocument();
  });

  it("keeps multiple assessment-round panels distinguishable by round name", () => {
    render(
      <>
        <FourFactorRoundResultPanel roundId="round-1" roundName="1회차" results={[]} />
        <FourFactorRoundResultPanel roundId="round-2" roundName="추가 평가" results={[]} />
      </>
    );

    expect(screen.getByText("1회차 · 체지방 제외 4요인 결과")).toBeInTheDocument();
    expect(screen.getByText("추가 평가 · 체지방 제외 4요인 결과")).toBeInTheDocument();
  });

  it("adapts the backend snapshot shape into the result panel view without body-fat fields", () => {
    const backendResult: PAPSStudentRoundResult = {
      roundId: "round-1",
      studentId: "student-1",
      revision: 2,
      previousRevision: 1,
      status: "finalized",
      studentSnapshot: {
        name: "김학생",
        sex: "female",
        gradeLevel: 5,
        classId: "class-5-1",
        classNumber: 1,
        studentNumber: 4
      },
      factors: {
        "cardiorespiratory-endurance": { factorId: "cardiorespiratory-endurance", eventId: "shuttle-run", sessionId: "s1", representativeAttemptId: "a1", measurement: 42, factorScore: 16 },
        flexibility: { factorId: "flexibility", eventId: "sit-and-reach", sessionId: "s2", representativeAttemptId: "a2", measurement: 18, factorScore: 15 },
        "strength-endurance": { factorId: "strength-endurance", eventId: "curl-up", sessionId: "s3", representativeAttemptId: "a3", measurement: 30, factorScore: 14 },
        power: { factorId: "power", eventId: "fifty-meter-run", sessionId: "s4", representativeAttemptId: "a4", measurement: 9.2, factorScore: 13 }
      },
      fourFactorSubtotal: 58,
      normalizedScore: 72.5,
      fourFactorGrade: 2,
      ruleVersion: "paps-four-factor-v1",
      ruleSource: "server",
      sourceFingerprint: "fingerprint",
      calculatedAt: "2026-08-26T00:00:00.000Z",
      finalizedAt: "2026-08-26T00:00:00.000Z",
      finalizedBy: "teacher-1"
    };

    const adapted = adaptRoundResult(backendResult);
    expect(adapted.studentName).toBe("김학생");
    expect(adapted.factors.power?.eventLabel).toBe("50m달리기");
    expect(adapted.factors.power?.unit).toBe("seconds");
    expect(adapted).not.toHaveProperty("bodyFat");
    expect(adapted).not.toHaveProperty("bmi");
  });

  it("shows 0/4 progress and finalized-result boundary without cumulative history", () => {
    const { rerender } = render(
      <FourFactorProgressCard
        progress={{
          roundName: "1회차",
          factors: [
            { factorId: "cardiorespiratory-endurance", eventLabel: "왕복오래달리기", complete: false },
            { factorId: "flexibility", eventLabel: "앉아윗몸앞으로굽히기", complete: false },
            { factorId: "strength-endurance", eventLabel: "윗몸말아올리기", complete: false },
            { factorId: "power", eventLabel: "50m달리기", complete: false }
          ]
        }}
      />
    );

    expect(screen.getByLabelText("4요인 진행 0/4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /다음 미측정 종목/ })).toHaveClass("gi-pulse");

    rerender(
      <FourFactorProgressCard
        progress={{
          factors: [
            { factorId: "cardiorespiratory-endurance", eventLabel: "왕복오래달리기", complete: true },
            { factorId: "flexibility", eventLabel: "앉아윗몸앞으로굽히기", complete: true },
            { factorId: "strength-endurance", eventLabel: "윗몸말아올리기", complete: true },
            { factorId: "power", eventLabel: "50m달리기", complete: true }
          ]
        }}
        finalizedResult={{ ...result, status: "finalized", factors: Object.values(result.factors) }}
      />
    );
    expect(screen.getByText("공식 PAPS 종합등급이 아닌 체지방 제외 4요인 환산 결과입니다.")).toBeInTheDocument();
    expect(screen.getByText("대표 기록 42 laps · 요인점수 16 / 20")).toBeInTheDocument();
    expect(screen.getByLabelText("확정된 4요인 대표 기록")).toBeInTheDocument();
  });

  it("reloads only the selected student's finalized round result from a signed group session", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        result: {
          student: { id: "student-a", name: "학생 A" },
          roundProgress: progress(4),
          finalizedResult: {
            ...result,
            studentId: "student-a",
            studentName: "학생 A",
            status: "finalized"
          }
        }
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SessionGroupView
        sessionGroupId="round-1"
        studentAccessToken="signed-student-token"
        sessions={groupSessions}
        assessmentProgress={progress(0)}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "학생 A" }));

    expect(await screen.findByText("선생님이 확정한 최종 결과")).toBeInTheDocument();
    expect(screen.getByText("58 / 80")).toBeInTheDocument();
    expect(screen.getByText("2등급")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/api/session-groups/round-1/students/student-a/round-status");
    expect(new Headers(init?.headers).get("x-paps-student-access-token")).toBe(
      "signed-student-token"
    );
  });

  it("resets shared round progress for student B but preserves student A while moving to the next factor session", async () => {
    let submissionCount = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      submissionCount += 1;
      return {
        ok: true,
        json: async () => ({
          result: {
            student: { id: submissionCount === 1 ? "student-a" : "student-b", name: submissionCount === 1 ? "학생 A" : "학생 B" },
            attempts: [],
            latestOfficialGrade: null,
            roundProgress: progress(1)
          }
        })
      };
    }));

    render(
      <SessionGroupView sessions={groupSessions} assessmentProgress={progress(0)} />
    );
    fireEvent.click(screen.getByRole("button", { name: "학생 A" }));
    fireEvent.change(screen.getByLabelText("왕복오래달리기 기록"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));
    await screen.findByLabelText("4요인 진행 1/4");

    fireEvent.click(screen.getByRole("button", { name: "학생 B" }));
    await screen.findByLabelText("4요인 진행 0/4");

    // A's progress is retained when the next-factor action changes the session.
    fireEvent.click(screen.getByRole("button", { name: "학생 A" }));
    await screen.findByLabelText("4요인 진행 0/4");
    fireEvent.change(screen.getByLabelText("왕복오래달리기 기록"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "기록 제출" }));
    await screen.findByLabelText("4요인 진행 1/4");
    fireEvent.click(screen.getByRole("button", { name: /다음 미측정 종목/ }));
    await screen.findAllByRole("button", { name: /앉아윗몸앞으로굽히기/ });
    expect(screen.getByLabelText("4요인 진행 1/4")).toBeInTheDocument();
  });

  it("does not offer ordinary structure editing for an assessment-linked session", () => {
    const onEdit = vi.fn();
    render(
      <SessionStatusList
        sessions={[{
          id: "session-linked",
          name: "4요인 심폐지구력",
          gradeLevel: 5,
          sessionType: "official",
          classScope: "single",
          eventId: "shuttle-run",
          classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
          assessmentRoundId: "round-1",
          factorId: "cardiorespiratory-endurance",
          isOpen: true,
          createdAt: "2026-08-26T00:00:00.000Z"
        }]}
        onEdit={onEdit}
      />
    );

    expect(screen.getByText("회차 결과에서 관리")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /수정/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "닫기" })).toBeInTheDocument();
  });
});
