import * as XLSX from "xlsx";

import {
  FOUR_FACTOR_ROUND_HEADER,
  FOUR_FACTOR_ROUND_TAB_NAME
} from "./four-factor-round-sheet";
import {
  PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "./template";

const createSettingsRows = (): string[][] => [
  ["학교명", "", "교사가 관리 페이지에서 설정", "", "학생명단", "학교 메타데이터"],
  ["학년도", "", "모든 탭에서 학년도 컬럼과 함께 사용", "", "학생명단", "학교 메타데이터"],
  ["담당교사 이메일", "", "구글 로그인 계정", "", "설정", "학교 메타데이터"],
  ["기본 세션 유형", "연습 기록", "세션 생성 시 바꿀 수 있음", "", "설정", "학교 메타데이터"],
  ["입력 화면 유형", "1반형", "관리 페이지에서 선택", "", "설정", "학교 메타데이터"],
  ["2반 분할 규칙", "같은 종목만 동시 기록", "같은 종목만 동시 기록", "", "설정", "운영 규칙"],
  ["학생 조회 정책", "제출 직후에만 자기 기록 확인", "공용 기기 보호 정책", "", "설정", "운영 규칙"],
  ["교사 화면 접근 PIN", "미설정", "학생 화면에서 교사 관리 화면으로 돌아갈 때 사용", "", "설정", "보안"],
  [
    PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL,
    PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION,
    "빈 PAPS 템플릿의 스키마 버전",
    "",
    "설정",
    "템플릿"
  ]
];

export const buildBlankPapsTemplateWorkbook = (): Buffer => {
  const workbook = XLSX.utils.book_new();

  for (const tab of PAPS_GOOGLE_SHEET_PROTOTYPE_TABS) {
    const rows = tab.tabName === "설정" ? createSettingsRows() : [];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([tab.header, ...rows]), tab.tabName);
  }

  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([Array.from(FOUR_FACTOR_ROUND_HEADER)]),
    FOUR_FACTOR_ROUND_TAB_NAME
  );

  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
};
