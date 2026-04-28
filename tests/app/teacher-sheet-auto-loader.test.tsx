import React from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

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

const disconnectedStatus = {
  code: "not_connected" as const,
  isConnected: false,
  canReconnect: true,
  summary: "구글 시트가 아직 연결되지 않았습니다.",
  detail: "설정 화면에서 템플릿 사본을 만들고 시트 URL을 저장해 주세요."
};

describe("teacher sheet auto loader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
    refresh.mockReset();
  });

  it("reconnects the last saved school sheet when the teacher page has no sheet cookie", async () => {
    window.localStorage.setItem(
      "paps:teacher-settings:saved-school",
      JSON.stringify({
        schoolId: "school-1",
        schoolName: "도촌초등학교",
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      })
    );
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
          school: {
            id: "school-1",
            name: "도촌초등학교",
            teacherIds: ["teacher-1"],
            sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
            teacherReturnPin: null,
            createdAt: "2026-04-28T00:00:00.000Z",
            updatedAt: "2026-04-28T00:00:00.000Z"
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const { TeacherSheetAutoLoader } = await import(
      "../../src/components/teacher/teacher-sheet-auto-loader"
    );

    render(<TeacherSheetAutoLoader sheetStatus={disconnectedStatus} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/google-sheet/connect",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          url: "https://docs.google.com/spreadsheets/d/sheet-verified/edit",
          schoolName: "도촌초등학교"
        })
      })
    );
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(JSON.parse(window.localStorage.getItem("paps:teacher-settings:saved-school") ?? "{}"))
      .toMatchObject({
        schoolId: "school-1",
        schoolName: "도촌초등학교",
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-verified/edit"
      });
  });
});
