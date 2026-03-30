import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  TeacherResultFilterOptions,
  TeacherResultRowView,
  TeacherResultSyncView
} from "../../src/lib/teacher-results";

vi.mock("../../src/components/teacher/result-table", () => ({
  ResultTable: ({
    rows
  }: {
    rows: TeacherResultRowView[];
  }) => (
    <div>
      <p data-testid="result-count">{rows.length}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.recordId}>{row.studentName}</li>
        ))}
      </ul>
    </div>
  )
}));

vi.mock("../../src/components/charts/teacher-progress-chart", () => ({
  TeacherProgressChart: ({ title }: { title: string }) => <div>{title}</div>
}));

vi.mock("../../src/components/teacher/sync-status-card", () => ({
  SyncStatusCard: ({ status }: { status: string }) => <div>sync:{status}</div>
}));

vi.mock("../../src/components/teacher/summary-exports-card", () => ({
  SummaryExportsCard: ({ note }: { note?: string }) => <div>{note}</div>
}));

const rows: TeacherResultRowView[] = [
  {
    recordId: "session-official-1:student-kim",
    sessionId: "session-official-1",
    studentId: "student-kim",
    studentName: "홍길동",
    studentNameNormalized: "홍길동",
    studentNumber: 1,
    classId: "class-5-1",
    classLabel: "5학년 1반",
    classNumber: 1,
    gradeLevel: 5,
    schoolId: "school-1",
    sessionName: "5학년 1반 3월 공식",
    sessionType: "official",
    eventId: "sit-and-reach",
    eventLabel: "앉아윗몸앞으로굽히기",
    unit: "cm",
    representativeAttemptId: "attempt-2",
    duplicateAttemptCount: 0,
    attempts: [
      {
        id: "attempt-2",
        attemptNumber: 2,
        measurement: 22,
        createdAt: "2026-03-30T09:21:00.000Z"
      }
    ]
  },
  {
    recordId: "session-practice-1:student-lee",
    sessionId: "session-practice-1",
    studentId: "student-lee",
    studentName: "이하나",
    studentNameNormalized: "이하나",
    studentNumber: 2,
    classId: "class-4-2",
    classLabel: "4학년 2반",
    classNumber: 2,
    gradeLevel: 4,
    schoolId: "school-1",
    sessionName: "4학년 2반 3월 연습",
    sessionType: "practice",
    eventId: "shuttle-run",
    eventLabel: "왕복오래달리기",
    unit: "laps",
    representativeAttemptId: null,
    duplicateAttemptCount: 0,
    attempts: [
      {
        id: "attempt-3",
        attemptNumber: 1,
        measurement: 32,
        createdAt: "2026-03-29T09:40:00.000Z"
      }
    ]
  }
];

const filterOptions: TeacherResultFilterOptions = {
  grades: [
    { value: 4, label: "4학년" },
    { value: 5, label: "5학년" }
  ],
  classes: [
    { value: "class-4-2", label: "4학년 2반", gradeLevel: 4 },
    { value: "class-5-1", label: "5학년 1반", gradeLevel: 5 }
  ],
  events: [
    { value: "shuttle-run", label: "왕복오래달리기" },
    { value: "sit-and-reach", label: "앉아윗몸앞으로굽히기" }
  ],
  sessionTypes: [
    { value: "all", label: "전체" },
    { value: "official", label: "공식" },
    { value: "practice", label: "연습" }
  ]
};

const syncStateByRecordId: Record<string, TeacherResultSyncView> = {
  "session-official-1:student-kim": {
    status: "synced",
    updatedAt: "2026-03-30T09:21:10.000Z",
    message: null
  },
  "session-practice-1:student-lee": {
    status: "pending",
    updatedAt: "-",
    message: null
  }
};

describe("teacher results workspace", () => {
  it("filters rows, shows empty state, and restores results on reset", async () => {
    const { TeacherResultsWorkspace } = await import(
      "../../src/components/teacher/teacher-results-workspace"
    );

    render(
      <TeacherResultsWorkspace
        rows={rows}
        filterOptions={filterOptions}
        initialFocusRecordId="session-practice-1:student-lee"
        syncStateByRecordId={syncStateByRecordId}
        sheetTabs={[]}
        failedSyncCount={0}
        summariesNote="이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다."
      />
    );

    expect(screen.getByRole("heading", { name: "검색 및 필터" })).toBeInTheDocument();
    expect(screen.getByText("현재 2건 / 전체 2건")).toBeInTheDocument();
    expect(screen.getByText("이하나 추이")).toBeInTheDocument();
    expect(
      screen.getByText("이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다.")
    ).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("학생 이름으로 검색"), {
      target: { value: "홍길" }
    });

    expect(screen.getByTestId("result-count")).toHaveTextContent("1");
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.queryByText("이하나")).not.toBeInTheDocument();
    expect(screen.getByText("홍길동 추이")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "연습" }));

    expect(screen.getByText("조건에 맞는 측정 결과가 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("검색어를 지우거나 필터를 초기화하면 전체 결과를 다시 볼 수 있습니다.")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "필터 초기화" }));

    expect(screen.getByText("현재 2건 / 전체 2건")).toBeInTheDocument();
    expect(screen.getByText("이하나")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
  });
});
