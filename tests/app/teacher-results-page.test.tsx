import React from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const cookies = vi.fn(async () => ({
  get: () => ({
    value: "sheet-live"
  })
}));
const refresh = vi.fn();

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/headers", () => ({
  cookies
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn()
  })
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

vi.mock("../../src/lib/teacher-results", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/teacher-results")>();

  return {
    ...actual,
    selectPrimaryResultsSession: (sessions: Array<{ id: string }>) => sessions[0] ?? null
  };
});

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
        "지난 기록 대비 +2cm"
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

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  TeacherDataRefresh: () => null,
  notifyTeacherDataRefresh: vi.fn()
}));

const loadTeacherPageState = vi.fn(async () => ({
  sheetConnected: true,
  sheetStatus: {
    code: "connected",
    isConnected: true,
    canReconnect: false,
    summary: "구글 시트가 연결되었습니다.",
    detail: null
  },
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
        schoolId: "school-1",
        academicYear: 2026,
        gradeLevel: 5,
        classNumber: 1,
        label: "5학년 1반",
        active: true
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
        schoolId: "school-1",
        gradeLevel: 5,
        studentNumber: 1,
        sex: "male",
        name: "홍길동",
        active: true
      }
    ],
    sessions: [
      {
        id: "session-official-1",
        schoolId: "school-1",
        teacherId: "teacher-1",
        academicYear: 2026,
        name: "5학년 1반 3월 공식 검증",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "class-1", eventId: "sit-and-reach" }],
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
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState
}));

describe("teacher results page copy", () => {
  afterEach(() => {
    cookies.mockReset();
    loadTeacherPageState.mockClear();
    refresh.mockReset();
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
    expect(screen.getByRole("link", { name: "요약 XLSX 다운로드" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "검색 및 필터" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "학생요약 미리보기" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "공식평가요약 미리보기" })).toBeInTheDocument();
    expect(
      screen.getByText("이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다.")
    ).toBeInTheDocument();
    expect(screen.getAllByText("홍길동")).toHaveLength(2);
    expect(screen.getByText("지난 기록 대비 +2cm")).toBeInTheDocument();
    expect(screen.getByText("5학년 1반 3월 공식 검증")).toBeInTheDocument();
    expect(screen.getByText("3등급")).toBeInTheDocument();
  });

  it("shows the specific spreadsheet problem when results cannot load", async () => {
    loadTeacherPageState.mockResolvedValueOnce({
      sheetConnected: false,
      sheetStatus: {
        code: "access_denied",
        isConnected: false,
        canReconnect: true,
        summary: "서비스 계정이 현재 구글 시트에 접근할 수 없습니다.",
        detail: "복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요."
      },
      store: null,
      bootstrap: {
        teacher: null,
        school: null,
        schools: [],
        classes: [],
        teachers: [],
        students: [],
        sessions: [],
        attempts: [],
        syncStatuses: [],
        syncErrorLogs: [],
        representativeSelectionAuditLogs: []
      }
    });

    const { default: TeacherResultsPage } = await import("../../app/teacher/results/page");

    render(await TeacherResultsPage());

    expect(screen.getByText("서비스 계정이 현재 구글 시트에 접근할 수 없습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요.")
    ).toBeInTheDocument();
  });
});
