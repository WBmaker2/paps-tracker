import React from "react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, vi } from "vitest";

import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

export const cookies = vi.fn(async () => ({
  get: () => undefined
}));
export const refresh = vi.fn();

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

type MockWorkbook = Record<string, string[][]>;

export const liveWorkbookState = new Map<string, MockWorkbook>();
export const sheetOperations: Array<{
  type: "update" | "append";
  spreadsheetId: string;
  range: string;
}> = [];

const normalizeTabName = (range: string): string =>
  range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";

const normalizeStartRow = (range: string): number => {
  const match = range.match(/![A-Z]+(\d+)/);

  return match ? Number(match[1]) : 1;
};

export const createWorkbook = (): MockWorkbook => ({
  설정: [
    ["항목", "값", "설명", "", "사용 탭", "역할"],
    ["학교명", "Demo Elementary", "교사가 관리 페이지에서 설정", "", "", ""],
    ["담당교사 이메일", "demo-teacher@example.com", "구글 로그인 계정", "", "", ""],
    [
      "__PAPS_SCHOOL",
      "demo-school",
      "Demo Elementary",
      "https://docs.google.com/spreadsheets/d/sheet-live/edit",
      "2026-03-23T09:00:00.000Z",
      "2026-03-23T09:00:00.000Z"
    ],
    ["__PAPS_TEACHER", "demo-teacher", "demo-school", "Demo Teacher", "demo-teacher@example.com", ""],
    ["__PAPS_TEACHER_META", "demo-teacher", "2026-03-23T09:00:00.000Z", "2026-03-23T09:00:00.000Z", "", ""],
    ["__PAPS_CLASS", "demo-class-5-1", "demo-school", "2026", "5", "1"],
    ["__PAPS_CLASS_META", "demo-class-5-1", "5-1", "Y", "", ""],
    ["__PAPS_SESSION", "session-official-1", "demo-school", "demo-teacher", "2026", "5-1 Sit And Reach"],
    ["__PAPS_SESSION_META", "session-official-1", "5", "official", "single", "sit-and-reach"],
    ["__PAPS_SESSION_STATUS", "session-official-1", "Y", "2026-03-23T09:10:00.000Z", "", ""],
    ["__PAPS_SESSION_TARGET", "session-official-1", "demo-class-5-1", "sit-and-reach", "0", ""]
  ],
  학생명단: [
    ["학생ID", "학년도", "학년", "반", "번호", "이름", "성별", "활성", "비고"],
    ["student-kim", "2026", "5", "1", "1", "Kim", "여", "Y", ""]
  ],
  세션기록: [
    [
      "기록ID",
      "세션ID",
      "세션명",
      "학년도",
      "측정일",
      "세션유형",
      "입력화면유형",
      "대상반표시",
      "실제반",
      "종목",
      "단위",
      "학생ID",
      "학생이름",
      "시도순번",
      "원측정값",
      "대표값선택",
      "대표값선정교사",
      "공식등급",
      "제출시각",
      "동기화상태",
      "비고"
    ],
    [
      "attempt-1",
      "session-official-1",
      "5-1 Sit And Reach",
      "2026",
      "2026-03-23",
      "공식",
      "1반형",
      "5-1",
      "1",
      "Sit and Reach",
      "cm",
      "student-kim",
      "Kim",
      "1",
      "18",
      "N",
      "",
      "",
      "2026-03-23 09:20:00",
      "실패",
      ""
    ],
    [
      "attempt-2",
      "session-official-1",
      "5-1 Sit And Reach",
      "2026",
      "2026-03-23",
      "공식",
      "1반형",
      "5-1",
      "1",
      "Sit and Reach",
      "cm",
      "student-kim",
      "Kim",
      "2",
      "22",
      "N",
      "",
      "",
      "2026-03-23 09:22:00",
      "실패",
      ""
    ]
  ],
  학생요약: [["학생ID", "이름", "학년", "반", "종목", "최신대표값", "단위", "직전대표값", "변화량", "최고대표값", "최근측정일", "학생표시문구"]],
  공식평가요약: [["학생ID", "이름", "학년", "반", "종목", "대표값", "단위", "공식등급", "측정일", "세션명", "비고"]],
  오류로그: [["시간", "수준", "구분", "메시지", "관련ID", "재시도상태", "해결시각"]],
  수정로그: [["시간", "교사계정", "세션ID", "학생ID", "종목", "작업", "이전기록ID", "선택기록ID", "사유"]]
});

vi.mock("../../src/lib/google/sheets-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/lib/google/sheets-client")>();

  return {
    ...actual,
    createGoogleSheetsClient: vi.fn(() => ({
      getSpreadsheet: vi.fn(async (spreadsheetId: string) => ({
        spreadsheetId,
        sheets: ["설정", "학생명단", "세션기록", "학생요약", "공식평가요약", "오류로그", "수정로그"].map(
          (title, index) => ({
            properties: {
              sheetId: index + 1,
              title
            }
          })
        )
      })),
      readRange: vi.fn(async (spreadsheetId: string, range: string) => {
        const workbook = liveWorkbookState.get(spreadsheetId) ?? createWorkbook();
        const tabName = normalizeTabName(range);
        const startRow = normalizeStartRow(range);

        return (workbook[tabName] ?? []).slice(Math.max(0, startRow - 1));
      }),
      appendRows: vi.fn(async (spreadsheetId: string, range: string, values: string[][]) => {
        const workbook = liveWorkbookState.get(spreadsheetId) ?? createWorkbook();
        const tabName = normalizeTabName(range);

        sheetOperations.push({
          type: "append",
          spreadsheetId,
          range
        });
        workbook[tabName] = [...(workbook[tabName] ?? []), ...values];
        liveWorkbookState.set(spreadsheetId, workbook);

        return {};
      }),
      updateRange: vi.fn(async (spreadsheetId: string, range: string, values: string[][]) => {
        const workbook = liveWorkbookState.get(spreadsheetId) ?? createWorkbook();
        const tabName = normalizeTabName(range);

        sheetOperations.push({
          type: "update",
          spreadsheetId,
          range
        });
        const cellMatch = range.match(/![A-Z]+\d+$/);

        if (cellMatch) {
          const address = cellMatch[0].slice(1);
          const columnLetters = address.match(/^[A-Z]+/)?.[0] ?? "A";
          const rowNumber = Number(address.match(/\d+$/)?.[0] ?? "1");
          const columnIndex = [...columnLetters].reduce(
            (total, character) => total * 26 + character.charCodeAt(0) - 64,
            0
          ) - 1;
          const updatedTab = [...(workbook[tabName] ?? [])].map((row) => [...row]);

          while (updatedTab.length < rowNumber) {
            updatedTab.push([]);
          }
          while ((updatedTab[rowNumber - 1]?.length ?? 0) <= columnIndex) {
            updatedTab[rowNumber - 1]?.push("");
          }
          updatedTab[rowNumber - 1]![columnIndex] = String(values[0]?.[0] ?? "");
          workbook[tabName] = updatedTab;
        } else {
          workbook[tabName] = values;
        }
        liveWorkbookState.set(spreadsheetId, workbook);

        return {};
      })
    }))
  };
});

vi.mock("../../src/lib/teacher-auth", () => ({
  getTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  TeacherDataRefresh: () => null,
  notifyTeacherDataRefresh: vi.fn(),
  buildTeacherMutationHeaders: (headers?: HeadersInit) => new Headers(headers)
}));

export const buildTeacherSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "Demo Elementary",
      teacherIds: ["demo-teacher"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/demo-sheet/edit",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "demo-class-5-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    },
    {
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    }
  ],
  teachers: [
    {
      id: "demo-teacher",
      schoolId: "demo-school",
      name: "Demo Teacher",
      email: "demo-teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [
    {
      id: "student-kim",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-2",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "session-official-1",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:10:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "session-official-1",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T09:20:00.000Z"
    },
    {
      id: "attempt-2",
      sessionId: "session-official-1",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 22,
      createdAt: "2026-03-23T09:22:00.000Z"
    }
  ],
  syncStatuses: [
    {
      id: "session-official-1:student-kim",
      sessionId: "session-official-1",
      studentId: "student-kim",
      status: "failed",
      attemptId: "attempt-2",
      updatedAt: "2026-03-23T09:25:00.000Z"
    }
  ],
  syncErrorLogs: [
    {
      id: "sync-error:session-official-1:student-kim:2026-03-23T09:25:00.000Z",
      sessionId: "session-official-1",
      studentId: "student-kim",
      syncStatusId: "session-official-1:student-kim",
      message: "Google Sheets API unavailable",
      createdAt: "2026-03-23T09:25:00.000Z"
    }
  ],
  representativeSelectionAuditLogs: []
});

export const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

export const installTeacherApiFetch = async () => {
  const sessionsRoute = await import("../../app/api/sessions/route");
  const representativeRoute = await import("../../app/api/records/[recordId]/representative/route");

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const pathname = new URL(url, "http://localhost").pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

      if (pathname === "/api/sessions" && method === "POST") {
        return sessionsRoute.POST(jsonRequest(pathname, method, body));
      }

      if (pathname.startsWith("/api/records/") && method === "PATCH") {
        const recordId = pathname.split("/")[3] ?? "";

        return representativeRoute.PATCH(jsonRequest(pathname, method, body), {
          params: Promise.resolve({ recordId })
        });
      }

      throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
    })
  );
};


const originalNodeEnv = process.env.NODE_ENV;
export const importRequestStore = () => import("../../src/lib/store/paps-memory-store");

beforeEach(async () => {
  vi.resetModules();
  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
    "-----BEGIN PRIVATE KEY-----\nmock-key\n-----END PRIVATE KEY-----\n";
  liveWorkbookState.set("sheet-live", createWorkbook());
  sheetOperations.length = 0;
  const { resetRequestStore } = await importRequestStore();
  resetRequestStore(buildTeacherSeed());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  cookies.mockReset();
  refresh.mockReset();
  liveWorkbookState.clear();
  sheetOperations.length = 0;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV");
  else Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
  const { resetRequestStore } = await importRequestStore();
  resetRequestStore();
});
