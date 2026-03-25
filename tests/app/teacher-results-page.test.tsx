import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookies = vi.fn(async () => ({
  get: () => ({
    value: "sheet-live"
  })
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/headers", () => ({
  cookies
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  }))
}));

vi.mock("../../src/components/charts/teacher-progress-chart", () => ({
  TeacherProgressChart: ({ title }: { title: string }) => <div>{title}</div>
}));

vi.mock("../../src/lib/teacher-results", () => ({
  selectPrimaryResultsSession: (sessions: Array<{ id: string }>) => sessions[0] ?? null
}));

vi.mock("../../src/lib/google/sheets", () => ({
  createPapsGoogleSheetTabPayloads: vi.fn(() => [
    {
      tabName: "학생요약",
      header: [
        "학생ID",
        "이름",
        "학년",
        "반",
        "종목",
        "최신대표값",
        "단위",
        "직전대표값",
        "변화량",
        "최고대표값",
        "최근측정일",
        "학생표시문구"
      ],
      rows: [[
        "student-kim",
        "홍길동",
        5,
        1,
        "Sit and Reach",
        22,
        "cm",
        20,
        2,
        22,
        "2026-03-25",
        "공식 기록 완료"
      ]]
    },
    {
      tabName: "공식평가요약",
      header: [
        "학생ID",
        "이름",
        "학년",
        "반",
        "종목",
        "대표값",
        "단위",
        "공식등급",
        "측정일",
        "세션명",
        "비고"
      ],
      rows: [[
        "student-kim",
        "홍길동",
        5,
        1,
        "Sit and Reach",
        22,
        "cm",
        3,
        "2026-03-25",
        "5학년 1반 3월 공식 검증",
        "공식 기록 완료"
      ]]
    },
    {
      tabName: "오류로그",
      header: Array.from({ length: 7 }, (_, index) => `col-${index + 1}`),
      rows: []
    }
  ])
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState: vi.fn(async () => ({
    sheetConnected: true,
    store: {
      listSessionRecords: vi.fn(async () => [
        {
          sessionId: "session-official-1",
          studentId: "student-kim",
          eventId: "sit-and-reach",
          unit: "cm",
          representativeAttemptId: null,
          attempts: [
            {
              id: "attempt-1",
              attemptNumber: 1,
              measurement: 21,
              createdAt: "2026-03-25T10:58:18.000Z"
            }
          ]
        }
      ])
    },
    bootstrap: {
      teacher: {
        id: "teacher-1",
        schoolId: "school-1"
      },
      school: {
        id: "school-1",
        name: "PAPS Demo School"
      },
      schools: [],
      classes: [
        {
          id: "class-1",
          label: "5학년 1반"
        }
      ],
      teachers: [
        {
          id: "teacher-1",
          schoolId: "school-1"
        }
      ],
      students: [
        {
          id: "student-kim",
          classId: "class-1",
          name: "홍길동"
        }
      ],
      sessions: [
        {
          id: "session-official-1",
          name: "5학년 1반 3월 공식 검증",
          eventId: "sit-and-reach",
          isOpen: true,
          createdAt: "2026-03-25T10:56:05.317Z"
        }
      ],
      attempts: [],
      syncStatuses: [
        {
          sessionId: "session-official-1",
          studentId: "student-kim",
          status: "synced",
          updatedAt: "2026-03-25T10:58:41.000Z"
        }
      ],
      syncErrorLogs: [],
      representativeSelectionAuditLogs: []
    }
  }))
}));

describe("teacher results page copy", () => {
  afterEach(() => {
    cookies.mockReset();
  });

  it("shows school-friendly wording on the results screen", async () => {
    const { default: TeacherResultsPage } = await import("../../app/teacher/results/page");

    render(await TeacherResultsPage());

    expect(screen.getByRole("heading", { name: "측정 결과 검토" })).toBeInTheDocument();
    expect(
      screen.getByText("대표 기록 확정, 요약 재계산, 시트 반영 현황을 한 화면에서 확인합니다.")
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "구글 시트 반영 현황" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "학생요약 CSV 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "공식평가요약 CSV 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "공식평가요약 미리보기" })).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("5학년 1반 3월 공식 검증")).toBeInTheDocument();
    expect(screen.getByText("3등급")).toBeInTheDocument();
  });
});
