import { describe, expect, it } from "vitest";

import {
  GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR,
  classifyTeacherSheetStatus
} from "../../src/lib/google/sheet-connection-status";
import {
  GoogleSheetsAccessError,
  GoogleSheetsApiDisabledError
} from "../../src/lib/google/sheets-client";

describe("teacher sheet connection status", () => {
  it("marks a missing spreadsheet cookie as not connected", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: null
      })
    ).toMatchObject({
      code: "not_connected",
      isConnected: false,
      summary: "구글 시트가 아직 연결되지 않았습니다."
    });
  });

  it("marks missing service-account env as a deployment setup issue", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: "sheet-123",
        error: new Error(GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR)
      })
    ).toMatchObject({
      code: "missing_service_account",
      isConnected: false,
      summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다."
    });
  });

  it("marks spreadsheet access failures as share-permission issues", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: "sheet-123",
        error: new GoogleSheetsAccessError("sheet-123", 403)
      })
    ).toMatchObject({
      code: "access_denied",
      isConnected: false,
      summary: "서비스 계정이 현재 구글 시트에 접근할 수 없습니다."
    });
  });

  it("marks disabled APIs separately from generic access errors", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: "sheet-123",
        error: new GoogleSheetsApiDisabledError({
          spreadsheetId: "sheet-123",
          status: 403,
          projectId: "1085328819177"
        })
      })
    ).toMatchObject({
      code: "api_disabled",
      isConnected: false,
      summary: "Google Sheets API가 비활성화되어 있습니다."
    });
  });

  it("marks stale teacher membership as a reconnect issue", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: "sheet-123",
        teacherAuthorized: false
      })
    ).toMatchObject({
      code: "teacher_not_authorized",
      isConnected: false,
      summary: "현재 교사 계정이 이 시트에 등록되어 있지 않습니다."
    });
  });

  it("falls back to a generic load error when the failure is unknown", () => {
    expect(
      classifyTeacherSheetStatus({
        spreadsheetId: "sheet-123",
        error: new Error("Temporary timeout")
      })
    ).toMatchObject({
      code: "load_failed",
      isConnected: false,
      summary: "구글 시트 연결 상태를 확인하지 못했습니다."
    });
  });
});
