import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTeacherStateVersion } from "../../src/lib/google/sheet-state-version";

const { requireTeacherRouteSession, loadTeacherPageState } = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn(),
  loadTeacherPageState: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession
}));

vi.mock("../../src/lib/google/sheets-store", () => ({
  PAPS_SPREADSHEET_ID_COOKIE: "paps-spreadsheet-id",
  loadTeacherPageState
}));

const connectedState = {
  store: null,
  sheetConnected: true,
  sheetStatus: {
    code: "connected",
    isConnected: true,
    canReconnect: false,
    summary: "구글 시트가 연결되었습니다.",
    detail: null
  },
  bootstrap: {
    teacher: {
      id: "teacher-1",
      schoolId: "school-1",
      name: "홍교사",
      email: "teacher@example.com",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    },
    school: {
      id: "school-1",
      name: "테스트 초등학교",
      teacherIds: ["teacher-1"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      createdAt: "2026-04-01T09:00:00.000Z",
      updatedAt: "2026-04-01T09:00:00.000Z"
    },
    schools: [],
    classes: [],
    teachers: [
      {
        id: "teacher-1",
        schoolId: "school-1",
        name: "홍교사",
        email: "teacher@example.com",
        createdAt: "2026-04-01T09:00:00.000Z",
        updatedAt: "2026-04-01T09:00:00.000Z"
      }
    ],
    students: [],
    sessions: [],
    attempts: [],
    syncStatuses: [],
    syncErrorLogs: [],
    representativeSelectionAuditLogs: []
  }
};

describe("teacher state version route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when the teacher session is missing", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    });

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/state-version"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns a version for a connected teacher sheet", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    loadTeacherPageState.mockResolvedValueOnce(connectedState);

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(
      new NextRequest("http://localhost/api/teacher/state-version", {
        headers: {
          cookie: "paps-spreadsheet-id=sheet-live"
        }
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      connected: true,
      version: buildTeacherStateVersion(connectedState.bootstrap),
      reason: null
    });
    expect(loadTeacherPageState).toHaveBeenCalledWith({
      teacherEmail: "teacher@example.com",
      spreadsheetId: "sheet-live"
    });
  });

  it("returns a disconnected payload when the teacher has no live sheet state", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    loadTeacherPageState.mockResolvedValueOnce({
      ...connectedState,
      sheetConnected: false,
      sheetStatus: {
        code: "not_connected",
        isConnected: false,
        canReconnect: true,
        summary: "연결된 구글 시트가 없습니다.",
        detail: "설정 화면에서 템플릿 사본을 만들고 시트 URL을 저장해 주세요."
      },
      bootstrap: {
        ...connectedState.bootstrap,
        teacher: null,
        school: null
      }
    });

    const route = await import("../../app/api/teacher/state-version/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/state-version"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      connected: false,
      version: null,
      reason: "not_connected"
    });
  });
});
