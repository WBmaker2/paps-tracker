import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStore } from "../../src/lib/demo-store";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

const cookies = vi.fn(async () => ({
  get: () => undefined
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
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

type MockWorkbook = Record<string, string[][]>;

const liveWorkbookState = new Map<string, MockWorkbook>();
const sheetOperations: Array<{
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

const createWorkbook = (): MockWorkbook => ({
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
        workbook[tabName] = values;
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

const createTempStorePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "paps-teacher-ui-")), "demo-store.json");

const buildTeacherSeed = (): PAPSDemoStoreData => ({
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

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

const installTeacherApiFetch = async () => {
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

describe("teacher representative and session flows", () => {
  let storePath = "";
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetModules();
    storePath = createTempStorePath();
    process.env.PAPS_STORE_PATH = storePath;
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nmock-key\n-----END PRIVATE KEY-----\n";
    liveWorkbookState.set("sheet-live", createWorkbook());
    sheetOperations.length = 0;
    createDemoStore({
      filePath: storePath,
      seedData: buildTeacherSeed()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cookies.mockReset();
    liveWorkbookState.clear();
    sheetOperations.length = 0;
    delete process.env.PAPS_STORE_PATH;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("creates a one-class or two-class session from the teacher dashboard", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");

    render(
      <SessionForm
        classes={createDemoStore({ filePath: storePath }).listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "5-1 Shuttle Run Practice" }
    });
    fireEvent.change(screen.getByLabelText("학년"), {
      target: { value: "5" }
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
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "shuttle-run" }
    });
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
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.change(screen.getByLabelText("보조 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await waitFor(() => {
      expect(createDemoStore({ filePath: storePath }).listSessions()).toHaveLength(3);
    });

    expect(
      createDemoStore({ filePath: storePath }).listSessions().map((session) => session.classScope)
    ).toEqual(["single", "single", "split"]);
  });

  it("blocks a two-class session when the selected classes do not share the same event", async () => {
    await installTeacherApiFetch();
    const { SessionForm } = await import("../../src/components/teacher/session-form");

    render(
      <SessionForm
        classes={createDemoStore({ filePath: storePath }).listClasses()}
        defaultTeacherId="demo-teacher"
        defaultSchoolId="demo-school"
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "잘못된 분할 세션" }
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
    fireEvent.change(screen.getByLabelText("주 종목"), {
      target: { value: "sit-and-reach" }
    });
    fireEvent.change(screen.getByLabelText("보조 종목"), {
      target: { value: "shuttle-run" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("Split sessions must use the same event for both classes.");

    expect(createDemoStore({ filePath: storePath }).listSessions()).toHaveLength(1);
  });

  it("lets a teacher choose the representative attempt", async () => {
    await installTeacherApiFetch();
    const { ResultTable } = await import("../../src/components/teacher/result-table");

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
      createDemoStore({ filePath: storePath }).getAttemptRecord({
        sessionId: "session-official-1",
        studentId: "student-kim"
      }).representativeAttemptId
    ).toBe("attempt-2");
  });

  it("shows sync failure status with a resync action", async () => {
    await installTeacherApiFetch();
    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");

    render(
      <SyncStatusCard
        recordId="session-official-1:student-kim"
        status="failed"
        updatedAt="2026-03-23T09:25:00.000Z"
        message="Google Sheets API unavailable"
      />
    );

    expect(screen.getByText("Google Sheets API unavailable")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "재동기화 요청" }));

    await screen.findByText("재동기화를 다시 대기열에 넣었습니다.");

    const updatedAt = createDemoStore({ filePath: storePath }).getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.updatedAt;

    expect(
      createDemoStore({ filePath: storePath }).getSyncStatus({
        sessionId: "session-official-1",
        studentId: "student-kim"
      })?.status
    ).toBe("pending");
    expect(updatedAt).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText(`마지막 업데이트: ${updatedAt}`)).toBeInTheDocument();
    });
  });

  it("writes only source-of-truth tabs for metadata and student mutations in the sheet-backed store", async () => {
    process.env.NODE_ENV = "production";
    const { createGoogleSheetsStoreForRequest } = await import("../../src/lib/google/sheets-store");

    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId: "sheet-live",
      teacherEmail: "demo-teacher@example.com"
    });

    await store.saveClass({
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
      active: true
    });

    expect(sheetOperations.map((entry) => entry.range)).toEqual(["'설정'!A1:F200"]);

    sheetOperations.length = 0;

    await store.saveStudent({
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    });

    expect(sheetOperations.map((entry) => entry.range)).toEqual(["'학생명단'!A1:I1000"]);
  });

  it("routes representative updates and results reads through the same sheet-backed store", async () => {
    process.env.NODE_ENV = "production";
    cookies.mockResolvedValue({
      get: (name: string) =>
        name === "paps-spreadsheet-id"
          ? {
              value: "sheet-live"
            }
          : undefined
    });

    const representativeRoute = await import("../../app/api/records/[recordId]/representative/route");
    const { createGoogleSheetsStoreForRequest } = await import("../../src/lib/google/sheets-store");
    const { default: TeacherResultsPage } = await import("../../app/teacher/results/page");

    const response = await representativeRoute.PATCH(
      new NextRequest("http://localhost/api/records/session-official-1:student-kim/representative", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          cookie: "paps-spreadsheet-id=sheet-live"
        },
        body: JSON.stringify({
          attemptId: "attempt-2",
          reason: "best-of-two"
        })
      }),
      {
        params: Promise.resolve({
          recordId: "session-official-1:student-kim"
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.record?.representativeAttemptId).toBe("attempt-2");
    expect(sheetOperations.map((entry) => entry.range)).toEqual([
      "'수정로그'!A1:I2000",
      "'세션기록'!A1:U5000"
    ]);
    expect(
      sheetOperations.some(
        (entry) =>
          entry.range === "'학생요약'!A1:L2000" || entry.range === "'공식평가요약'!A1:K2000"
      )
    ).toBe(false);

    const store = await createGoogleSheetsStoreForRequest({
      spreadsheetId: "sheet-live",
      teacherEmail: "demo-teacher@example.com"
    });
    const record = (await store.listSessionRecords("session-official-1"))
      .find((entry) => entry.studentId === "student-kim");

    expect(record?.representativeAttemptId).toBe("attempt-2");

    render(await TeacherResultsPage());

    expect(screen.getByRole("button", { name: "2회차 대표값" })).toBeInTheDocument();
  });
});
