import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { GoogleSheetsAccessError } from "../../src/lib/google/sheets-client";
import { buildSeed, createLockedSheetClient, importRequestStore, jsonRequest, notifyTeacherDataRefresh } from "./teacher-settings-test-helpers";

describe("teacher settings management", () => {
  beforeEach(async () => {
    vi.resetModules();
    notifyTeacherDataRefresh.mockReset();
    process.env.GOOGLE_SHEETS_TEMPLATE_ID = "template-sheet-id";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "service-account@example.com";
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nmock-key\n-----END PRIVATE KEY-----\n";
    const { resetRequestStore } = await importRequestStore();
    resetRequestStore(buildSeed());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    delete process.env.GOOGLE_SHEETS_TEMPLATE_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  });

  it("requires an existing teacher approval code when the current teacher is missing from the sheet", async () => {
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const requestBodies: unknown[] = [];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : {};

      requestBodies.push(body);

      if (body.teacherInviteToken === "approved-invite") {
        return Response.json({
          ok: true,
          school: {
            id: "locked-school",
            name: "도촌초등학교",
            teacherIds: ["teacher-other", "teacher-demo-teacher-example-com"],
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
            createdAt: "2026-03-24T09:00:00.000Z",
            updatedAt: "2026-04-21T09:00:00.000Z"
          },
          normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-owned/edit"
        });
      }

      return Response.json(
        {
          ok: false,
          code: "teacher_not_authorized",
          action: "enter_teacher_invite",
          error: "The current teacher is not authorized for this spreadsheet."
        },
        { status: 409 }
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeacherSettingsManager
        school={null}
        classes={[]}
        sheetConnected={false}
        sheetStatus={{
          code: "teacher_not_authorized",
          isConnected: false,
          canReconnect: true,
          summary: "현재 로그인한 교사가 이 시트의 담당교사 목록에 없습니다.",
          detail: "기존 시트를 가져오면 현재 교사를 담당교사로 추가할 수 있습니다."
        }}
        sheetSetupStatus={{
          templateConfigured: true,
          serviceAccountConfigured: true,
          serviceAccountEmail: "service-account@example.com",
          missingKeys: []
        }}
      />
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "도촌초등학교" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-owned/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("기존 PAPS 시트 승인 코드");
    await waitFor(() => expect(requestBodies).toHaveLength(1));
    fireEvent.change(screen.getByLabelText("교사 추가 승인 코드"), {
      target: { value: "approved-invite" }
    });

    fireEvent.click(screen.getByRole("button", { name: "승인 코드로 연결" }));

    await screen.findByText("승인된 기존 시트를 연결하고 현재 교사를 추가했습니다.");
    expect(requestBodies).toEqual([
      {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "도촌초등학교"
      },
      {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "도촌초등학교",
        teacherInviteToken: "approved-invite"
      }
    ]);
  });

  it("updates PIN and class cards immediately after saving school information", async () => {
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          school: {
            id: "connected-school",
            name: "도촌초등학교",
            teacherIds: ["teacher-demo-teacher-example-com"],
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-connected/edit",
            teacherReturnPinConfigured: true,
            createdAt: "2026-03-24T09:00:00.000Z",
            updatedAt: "2026-04-29T09:00:00.000Z"
          },
          classes: [
            {
              id: "connected-class-4-1",
              schoolId: "connected-school",
              academicYear: 2026,
              gradeLevel: 4,
              classNumber: 1,
              label: "4-1",
              active: true
            },
            {
              id: "connected-class-3-1",
              schoolId: "connected-school",
              academicYear: 2026,
              gradeLevel: 3,
              classNumber: 1,
              label: "3-1",
              active: true
            }
          ],
          normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-connected/edit"
        })
      )
    );

    render(
      <TeacherSettingsManager
        school={null}
        classes={[]}
        sheetConnected={false}
        sheetStatus={{
          code: "not_connected",
          isConnected: false,
          canReconnect: true,
          summary: "연결된 구글 시트가 없습니다.",
          detail: null
        }}
        sheetSetupStatus={{
          templateConfigured: true,
          serviceAccountConfigured: true,
          serviceAccountEmail: "service-account@example.com",
          missingKeys: []
        }}
      />
    );

    expect(screen.getByText("PIN 미설정")).toBeInTheDocument();
    expect(screen.queryByText("3-1")).not.toBeInTheDocument();
    expect(screen.queryByText("4-1")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "도촌초등학교" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-connected/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");
    expect(screen.getByText("PIN 설정됨")).toBeInTheDocument();
    expect(screen.getByText("3-1")).toBeInTheDocument();
    expect(screen.getByText("4-1")).toBeInTheDocument();
    const connectionGuide = screen
      .getByText("구글 시트 연결 안내 다시 보기")
      .closest("details");

    expect(connectionGuide).not.toHaveAttribute("open");
    expect(screen.getByText("담당교사 추가 승인 코드 만들기")).toBeInTheDocument();
  });

  it("rejects connect requests when the service account is not shared on the sheet", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce({
      getSpreadsheet: vi.fn(async () => {
        throw new GoogleSheetsAccessError("sheet-unshared", 403);
      }),
      readRange: vi.fn(async () => []),
      appendRows: vi.fn(async () => ({})),
      updateRange: vi.fn(async () => ({}))
    });

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-unshared/edit",
        schoolName: "Blocked School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("cannot access spreadsheet sheet-unshared");
  });

  it("rejects connect requests when persisted teacher membership belongs to another email", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce({
      getSpreadsheet: vi.fn(async () => ({
        spreadsheetId: "sheet-owned",
        sheets: [
          "설정",
          "학생명단",
          "세션기록",
          "학생요약",
          "공식평가요약",
          "오류로그",
          "수정로그"
        ].map((title, index) => ({
          properties: {
            sheetId: index + 1,
            title
          }
        }))
      })),
      readRange: vi.fn(async (_spreadsheetId: string, range: string) => {
        if (range === "'설정'!A1:C20") {
          return [
            ["항목", "값", "설명"],
            ["시트 템플릿 버전", "v0.1-prototype", "프로토타입 예시"]
          ];
        }

        const tabName = range.split("!")[0]?.replace(/^'/, "").replace(/'$/, "") ?? "";
        const headers: Record<string, string[]> = {
          설정: ["항목", "값", "설명", "", "사용 탭", "역할"],
          학생명단: ["학생ID", "학년도", "학년", "반", "번호", "이름", "성별", "활성", "비고"],
          세션기록: [
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
          학생요약: [
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
          공식평가요약: ["학생ID", "이름", "학년", "반", "종목", "대표값", "단위", "공식등급", "측정일", "세션명", "비고"],
          오류로그: ["시간", "수준", "구분", "메시지", "관련ID", "재시도상태", "해결시각"],
          수정로그: ["시간", "교사계정", "세션ID", "학생ID", "종목", "작업", "이전기록ID", "선택기록ID", "사유"]
        };

        if (range.endsWith("!A1:Z1")) {
          return [headers[tabName] ?? []];
        }

        if (range === "'설정'!A2:F") {
          return [
            ["학교명", "Locked School", "교사가 관리 페이지에서 설정", "", "", ""],
            ["__PAPS_SCHOOL", "locked-school", "Locked School", "https://docs.google.com/spreadsheets/d/sheet-owned/edit", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z"],
            ["__PAPS_TEACHER", "teacher-other", "locked-school", "Other Teacher", "other-teacher@example.com", ""],
            ["__PAPS_TEACHER_META", "teacher-other", "2026-03-24T09:00:00.000Z", "2026-03-24T09:00:00.000Z", "", ""]
          ];
        }

        return [];
      }),
      appendRows: vi.fn(async () => ({})),
      updateRange: vi.fn(async () => ({}))
    });

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "Locked School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.code).toBe("teacher_not_authorized");
    expect(payload.action).toBe("enter_teacher_invite");
    expect(payload.error).toBe("The current teacher is not authorized for this spreadsheet.");
  });

  it("adds the current teacher only when an existing teacher issued a matching approval", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const sheetsClient = await import("../../src/lib/google/sheets-client");
    const { createTeacherSheetInviteToken } = await import(
      "../../src/lib/google/teacher-sheet-invite"
    );
    const updateRange = vi.fn(async () => ({}));
    process.env.NEXTAUTH_SECRET = "teacher-invite-route-secret";
    const teacherInviteToken = createTeacherSheetInviteToken({
      spreadsheetId: "sheet-owned",
      inviterEmail: "other-teacher@example.com",
      targetEmail: "demo-teacher@example.com"
    });

    vi.mocked(sheetsClient.createGoogleSheetsClient).mockReturnValueOnce(
      createLockedSheetClient(updateRange)
    );

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-owned/edit",
        schoolName: "Locked School",
        teacherInviteToken
      })
    );
    const payload = await response.json();
    const settingsUpdate = updateRange.mock.calls.find(
      ([, range]) => range === "'설정'!A:F"
    );
    const settingsRows = settingsUpdate?.[2] as string[][] | undefined;

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.school.teacherReturnPin).toBeNull();
    expect(payload.school.teacherReturnPinConfigured).toBe(true);
    expect(payload.classes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "locked-class-4-1",
          label: "4-1"
        })
      ])
    );
    expect(settingsRows).toEqual(
      expect.arrayContaining([
        [
          "__PAPS_TEACHER",
          "teacher-other",
          "locked-school",
          "Other Teacher",
          "other-teacher@example.com",
          ""
        ],
        [
          "__PAPS_TEACHER",
          "teacher-demo-teacher-example-com",
          "locked-school",
          "Demo Teacher",
          "demo-teacher@example.com",
          ""
        ]
      ])
    );
  });

  it("fails clearly when connect is attempted without service-account env", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
        schoolName: "Missing Env School"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Google Sheets service account environment variables are missing.");
  });

  it("fails clearly when validate is attempted without service-account env", async () => {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

    const validateRoute = await import("../../app/api/google-sheet/validate/route");
    const response = await validateRoute.POST(
      jsonRequest("/api/google-sheet/validate", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      ok: false,
      status: "missing_service_account",
      spreadsheetId: "sheet-verified",
      templateVersion: null,
      summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다."
    });
  });
});
