import {
  GoogleSheetsAccessError,
  GoogleSheetsApiDisabledError
} from "./sheets-client";

export const GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR =
  "Google Sheets service account environment variables are missing.";

export type TeacherSheetStatusCode =
  | "connected"
  | "not_connected"
  | "missing_service_account"
  | "access_denied"
  | "api_disabled"
  | "teacher_not_authorized"
  | "load_failed";

export interface TeacherSheetStatus {
  code: TeacherSheetStatusCode;
  isConnected: boolean;
  canReconnect: boolean;
  summary: string;
  detail: string | null;
}

export const createConnectedTeacherSheetStatus = (): TeacherSheetStatus => ({
  code: "connected",
  isConnected: true,
  canReconnect: false,
  summary: "구글 시트가 연결되었습니다.",
  detail: null
});

export const classifyTeacherSheetStatus = ({
  spreadsheetId,
  teacherAuthorized = true,
  error
}: {
  spreadsheetId: string | null | undefined;
  teacherAuthorized?: boolean;
  error?: unknown;
}): TeacherSheetStatus => {
  if (!spreadsheetId) {
    return {
      code: "not_connected",
      isConnected: false,
      canReconnect: true,
      summary: "구글 시트가 아직 연결되지 않았습니다.",
      detail: "설정 화면에서 템플릿 사본을 만들고 시트 URL을 저장해 주세요."
    };
  }

  if (!teacherAuthorized) {
    return {
      code: "teacher_not_authorized",
      isConnected: false,
      canReconnect: true,
      summary: "현재 교사 계정이 이 시트에 등록되어 있지 않습니다.",
      detail: "다른 시트를 연결했거나 시트의 교사 목록이 바뀌었을 수 있습니다. 설정 화면에서 다시 연결해 주세요."
    };
  }

  if (!error) {
    return createConnectedTeacherSheetStatus();
  }

  if (error instanceof Error && error.message === GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR) {
    return {
      code: "missing_service_account",
      isConnected: false,
      canReconnect: false,
      summary: "배포 환경에 Google Sheets 서비스 계정 설정이 없습니다.",
      detail: "설정 화면의 환경변수 경고를 확인한 뒤 다시 시도해 주세요."
    };
  }

  if (error instanceof GoogleSheetsApiDisabledError) {
    return {
      code: "api_disabled",
      isConnected: false,
      canReconnect: false,
      summary: "Google Sheets API가 비활성화되어 있습니다.",
      detail: error.message
    };
  }

  if (error instanceof GoogleSheetsAccessError) {
    return {
      code: "access_denied",
      isConnected: false,
      canReconnect: true,
      summary: "서비스 계정이 현재 구글 시트에 접근할 수 없습니다.",
      detail: "복사한 시트를 서비스 계정 이메일에 편집자로 공유했는지 확인해 주세요."
    };
  }

  return {
    code: "load_failed",
    isConnected: false,
    canReconnect: true,
    summary: "구글 시트 연결 상태를 확인하지 못했습니다.",
    detail: error instanceof Error ? error.message : "잠시 후 다시 시도해 주세요."
  };
};

export const getTeacherSheetStatusHttpStatus = (status: TeacherSheetStatus): number => {
  switch (status.code) {
    case "connected":
      return 200;
    case "not_connected":
    case "missing_service_account":
      return 409;
    case "access_denied":
    case "teacher_not_authorized":
      return 403;
    case "api_disabled":
      return 503;
    case "load_failed":
    default:
      return 502;
  }
};
