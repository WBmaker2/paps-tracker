import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, vi } from "vitest";
import { buildSeed, importRequestStore, jsonRequest, notifyTeacherDataRefresh } from "./teacher-settings-test-helpers";

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

  it("updates school info and adds a class from the settings management UI", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");
    const templateRoute = await import("../../app/api/google-sheet/template/route");
    const schoolsRoute = await import("../../app/api/schools/route");
    const classesRoute = await import("../../app/api/classes/route");
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const openSpy = vi.fn();

    vi.stubGlobal("open", openSpy);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/schools" && method === "POST") {
          return schoolsRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/google-sheet/connect" && method === "POST") {
          return connectRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/google-sheet/template" && method === "POST") {
          return templateRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/classes" && method === "POST") {
          return classesRoute.POST(jsonRequest(pathname, method, body));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    const { getRequestStore } = await importRequestStore();
    const store = getRequestStore();
    const school = store.getSchool("demo-school");
    const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={school}
          classes={classes}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: true,
            serviceAccountEmail: "service-account@example.com",
            missingKeys: []
          }}
        />
      </AppShell>
    );

    fireEvent.click(screen.getByRole("button", { name: "기존 템플릿 복사" }));

    await screen.findByText(/새 탭에서 템플릿 복사 화면을 열었습니다/);

    expect(openSpy).toHaveBeenCalledWith(
      "https://docs.google.com/spreadsheets/d/template-sheet-id/copy",
      "_blank",
      "noopener,noreferrer"
    );

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "Updated Elementary" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: { value: "https://docs.google.com/spreadsheets/d/sheet-verified/edit" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");
    expect(notifyTeacherDataRefresh).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("새 학급 학년"), {
      target: { value: "6" }
    });
    fireEvent.change(screen.getByLabelText("반(숫자입력)"), {
      target: { value: "2" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학급 추가" }));

    await screen.findByText("학급을 추가했습니다.");
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: expect.any(String)
    });

    await waitFor(() => {
      const reloadedStore = store;

      expect(reloadedStore.getSchool("demo-school").name).toBe("Updated Elementary");
      expect(reloadedStore.getSchool("demo-school").sheetUrl).toBe(
        "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      );
      expect(reloadedStore.listClasses().some((entry) => entry.label === "6-2")).toBe(true);
    });

    expect(screen.getByText("6-2")).toBeInTheDocument();
    expect(screen.queryByLabelText("새 학급 이름")).not.toBeInTheDocument();
  });

  it("sets a durable spreadsheet cookie when school information is saved", async () => {
    const connectRoute = await import("../../app/api/google-sheet/connect/route");

    const response = await connectRoute.POST(
      jsonRequest("/api/google-sheet/connect", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
        schoolName: "Durable Cookie School"
      })
    );
    const setCookieHeader = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(setCookieHeader).toContain("paps-spreadsheet-id=sheet-verified");
    expect(setCookieHeader).toContain("HttpOnly");
    expect(setCookieHeader).toContain("SameSite=lax");
    expect(setCookieHeader).toContain("Path=/");
    expect(setCookieHeader).toContain("Max-Age=31536000");
  });

  it("sets and clears the teacher return PIN from the settings screen", async () => {
    const pinRoute = await import("../../app/api/teacher/student-return-pin/route");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const { getRequestStore } = await importRequestStore();
    const store = getRequestStore();
    const school = store.getSchool("demo-school");

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const pathname = new URL(url, "http://localhost").pathname;
        const method = (init?.method ?? "GET").toUpperCase();
        const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

        if (pathname === "/api/teacher/student-return-pin" && method === "POST") {
          return pinRoute.POST(jsonRequest(pathname, method, body));
        }

        if (pathname === "/api/teacher/student-return-pin" && method === "DELETE") {
          return pinRoute.DELETE(jsonRequest(pathname, method));
        }

        throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
      })
    );

    render(
      <TeacherSettingsManager
        school={school}
        classes={[]}
        sheetSetupStatus={{
          templateConfigured: true,
          serviceAccountConfigured: true,
          serviceAccountEmail: "service-account@example.com",
          missingKeys: []
        }}
      />
    );

    expect(screen.getByText("PIN 미설정")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("새 PIN"), {
      target: { value: "2468" }
    });
    fireEvent.change(screen.getByLabelText("새 PIN 확인"), {
      target: { value: "2468" }
    });
    fireEvent.click(screen.getByRole("button", { name: "PIN 저장" }));

    await screen.findByText("교사 화면 접근 PIN을 저장했습니다.");

    expect(screen.getByText("PIN 설정됨")).toBeInTheDocument();
    expect(store.getSchool("demo-school").teacherReturnPin?.hash).not.toContain("2468");
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: expect.any(String)
    });

    const clearPinButton = screen.getByRole("button", { name: "PIN 해제" });
    await waitFor(() => expect(clearPinButton).not.toBeDisabled());
    fireEvent.click(clearPinButton);

    await screen.findByText("교사 화면 접근 PIN을 해제했습니다.");
    expect(screen.getByText("PIN 미설정")).toBeInTheDocument();
    expect(store.getSchool("demo-school").teacherReturnPin).toBeNull();
  });

  it("restores the last saved school info after the settings form remounts", async () => {
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );
    const fetchMock = vi.fn(async () =>
      Response.json({
        school: {
          id: "demo-school",
          name: "도촌초등학교",
          teacherIds: ["demo-teacher"],
          sheetUrl:
            "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-04-15T09:00:00.000Z"
        },
        normalizedUrl:
          "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const renderManager = () =>
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

    const firstRender = renderManager();

    fireEvent.change(screen.getByLabelText("학교명"), {
      target: { value: "도촌초등학교" }
    });
    fireEvent.change(screen.getByLabelText("구글 시트 URL"), {
      target: {
        value:
          "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "학교 정보 저장" }));

    await screen.findByText("학교 정보를 저장했습니다.");

    firstRender.unmount();
    renderManager();

    expect((screen.getByLabelText("학교명") as HTMLInputElement).value).toBe("도촌초등학교");
    expect((screen.getByLabelText("구글 시트 URL") as HTMLInputElement).value).toBe(
      "https://docs.google.com/spreadsheets/d/1nkle8q817RCds477sj3f5Ajya5eqVYgzJlkfNZ8nZYQ/edit"
    );
  });

  it("shows setup guidance and missing env warning when service account config is incomplete", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={null}
          classes={[]}
          sheetConnected={false}
          sheetStatus={{
            code: "missing_service_account",
            isConnected: false,
            canReconnect: false,
            summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다.",
            detail: "설정 화면의 환경변수 경고를 확인한 뒤 다시 시도해 주세요."
          }}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: false,
            serviceAccountEmail: null,
            missingKeys: [
              "GOOGLE_SERVICE_ACCOUNT_EMAIL",
              "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY"
            ]
          }}
        />
      </AppShell>
    );

    expect(screen.getByText("구글 시트 최초 연결 안내")).toBeInTheDocument();
    expect(screen.getByText("1. 사용할 시트 준비하기")).toBeInTheDocument();
    expect(screen.getByText("2. 서비스 계정을 편집자로 공유")).toBeInTheDocument();
    expect(screen.getByText("3. 사본 URL 입력 후 학교 정보 저장")).toBeInTheDocument();
    expect(screen.getByText("배포 설정 확인 필요")).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_SERVICE_ACCOUNT_EMAIL/)).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY/)).toBeInTheDocument();
  });

  it("shows the current spreadsheet issue separately from first-time setup guidance", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSettingsManager } = await import(
      "../../src/components/teacher/settings-management"
    );

    render(
      <AppShell
        title="학교 및 학급 설정"
        eyebrow="Settings"
        description="학교 정보와 학급을 관리합니다."
      >
        <TeacherSettingsManager
          school={null}
          classes={[]}
          sheetConnected={false}
          sheetStatus={{
            code: "access_denied",
            isConnected: false,
            canReconnect: true,
            summary: "서비스 계정이 현재 구글 시트에 접근할 수 없습니다.",
            detail: "복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요."
          }}
          sheetSetupStatus={{
            templateConfigured: true,
            serviceAccountConfigured: true,
            serviceAccountEmail: "service-account@example.com",
            missingKeys: []
          }}
        />
      </AppShell>
    );

    expect(screen.getByText("현재 연결 문제")).toBeInTheDocument();
    expect(
      screen.getByText("서비스 계정이 현재 구글 시트에 접근할 수 없습니다.")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요.")
    ).toHaveLength(2);
  });

});
