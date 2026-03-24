import { getGoogleSheetsEnv } from "../env";
import { createGoogleSheetsCopyLink, parseGoogleSheetsSpreadsheetId } from "./drive-link";

export const PAPS_GOOGLE_SHEET_TEMPLATE_VERSION = "v0.1-prototype";
export const PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL = "시트 템플릿 버전";

export interface GoogleSheetsPrototypeTab {
  tabName: string;
  header: string[];
}

export const PAPS_GOOGLE_SHEET_PROTOTYPE_TABS: GoogleSheetsPrototypeTab[] = [
  {
    tabName: "설정",
    header: ["항목", "값", "설명", "", "사용 탭", "역할"]
  },
  {
    tabName: "학생명단",
    header: ["학생ID", "학년도", "학년", "반", "번호", "이름", "성별", "활성", "비고"]
  },
  {
    tabName: "세션기록",
    header: [
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
    ]
  },
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
    ]
  },
  {
    tabName: "공식평가요약",
    header: ["학생ID", "이름", "학년", "반", "종목", "대표값", "단위", "공식등급", "측정일", "세션명", "비고"]
  },
  {
    tabName: "오류로그",
    header: ["시간", "수준", "구분", "메시지", "관련ID", "재시도상태", "해결시각"]
  },
  {
    tabName: "수정로그",
    header: ["시간", "교사계정", "세션ID", "학생ID", "종목", "작업", "이전기록ID", "선택기록ID", "사유"]
  }
];

export interface GoogleSheetsTemplateLink {
  templateSpreadsheetId: string;
  templateUrl: string;
  copyUrl: string;
}

const createTemplateEditUrl = (spreadsheetId: string): string =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

export const resolveGoogleSheetsTemplateLink = (input?: {
  templateId?: string;
  templateUrl?: string;
}): GoogleSheetsTemplateLink => {
  const env = getGoogleSheetsEnv();
  const templateId = input?.templateId?.trim();
  let templateSpreadsheetId = templateId ?? null;

  if (!templateSpreadsheetId && input?.templateUrl) {
    try {
      templateSpreadsheetId = parseGoogleSheetsSpreadsheetId(input.templateUrl);
    } catch (error) {
      if (!env.templateId) {
        throw error;
      }
    }
  }

  if (!templateSpreadsheetId) {
    templateSpreadsheetId = env.templateId;
  }

  if (!templateSpreadsheetId) {
    throw new Error("Google Sheets template configuration is missing.");
  }

  return {
    templateSpreadsheetId,
    templateUrl: createTemplateEditUrl(templateSpreadsheetId),
    copyUrl: createGoogleSheetsCopyLink({ spreadsheetId: templateSpreadsheetId })
  };
};
