import type { PAPSAssessmentRound, PAPSStudentRoundResult, PAPSFourFactorId } from "../paps/types";
import { FOUR_FACTOR_IDS } from "../paps/four-factor-score";
import type { GoogleSheetsCellValue, GoogleSheetsClient, GoogleSpreadsheetMetadata } from "./sheets-client";

export const FOUR_FACTOR_ROUND_TAB_NAME = "4요인회차결과";
export const FOUR_FACTOR_ROUND_HEADER = [
  "회차ID", "학생ID", "결과Revision", "결과상태", "회차상태", "학년도", "회차유형", "회차번호", "학교ID", "학년", "반ID", "반", "번호", "학생이름", "성별",
  "심폐지구력_종목ID", "심폐지구력_세션ID", "심폐지구력_대표시도ID", "심폐지구력_원측정값", "심폐지구력_요인점수",
  "유연성_종목ID", "유연성_세션ID", "유연성_대표시도ID", "유연성_원측정값", "유연성_요인점수",
  "근력·근지구력_종목ID", "근력·근지구력_세션ID", "근력·근지구력_대표시도ID", "근력·근지구력_원측정값", "근력·근지구력_요인점수",
  "순발력_종목ID", "순발력_세션ID", "순발력_대표시도ID", "순발력_원측정값", "순발력_요인점수",
  "4요인합계", "체지방 제외 환산점수", "체지방 제외 4요인등급", "규칙버전", "규칙출처", "원자료Fingerprint", "계산시각", "확정시각", "확정교사ID", "이전Revision", "저장시각"
] as const;

const value = (cell: string | number | null | undefined): GoogleSheetsCellValue => cell ?? "";

export const buildFourFactorRoundResultRow = (round: PAPSAssessmentRound, result: PAPSStudentRoundResult): GoogleSheetsCellValue[] => {
  const factorCells = FOUR_FACTOR_IDS.flatMap((factorId) => {
    const factor = result.factors[factorId];
    return [factor.eventId, factor.sessionId, value(factor.representativeAttemptId), value(factor.measurement), value(factor.factorScore)];
  });
  return [
    round.id, result.studentId, result.revision, result.status, round.status, round.academicYear, round.roundType, round.roundNumber, round.schoolId,
    result.studentSnapshot.gradeLevel, result.studentSnapshot.classId, value(result.studentSnapshot.classNumber), value(result.studentSnapshot.studentNumber), result.studentSnapshot.name, result.studentSnapshot.sex,
    ...factorCells,
    value(result.fourFactorSubtotal), value(result.normalizedScore), value(result.fourFactorGrade), result.ruleVersion, result.ruleSource,
    value(result.sourceFingerprint), value(result.calculatedAt), value(result.finalizedAt), value(result.finalizedBy), value(result.previousRevision), new Date().toISOString()
  ];
};

export const parseFourFactorRoundResultRows = (rows: string[][]): Array<{ roundId: string; studentId: string; revision: number; row: string[] }> => rows.filter((row) => row[0] && row[1] && Number.isInteger(Number(row[2]))).map((row) => ({ roundId: row[0]!, studentId: row[1]!, revision: Number(row[2]), row }));

export const ensureFourFactorRoundSheet = async (input: { client: GoogleSheetsClient; spreadsheetId: string }): Promise<void> => {
  const spreadsheet: GoogleSpreadsheetMetadata = await input.client.getSpreadsheet(input.spreadsheetId);
  if (spreadsheet.sheets.some((sheet) => sheet.properties.title === FOUR_FACTOR_ROUND_TAB_NAME)) {
    const header = await input.client.readRange(input.spreadsheetId, `'${FOUR_FACTOR_ROUND_TAB_NAME}'!A1:AU1`);
    if ((header[0] ?? []).join("\u0001") !== FOUR_FACTOR_ROUND_HEADER.join("\u0001")) {
      throw new Error("FOUR_FACTOR_ROUND_SCHEMA_MISMATCH");
    }
    return;
  }
  if (!input.client.addSheet) throw new Error("FOUR_FACTOR_ROUND_SCHEMA_MIGRATION_UNAVAILABLE");
  await input.client.addSheet(input.spreadsheetId, FOUR_FACTOR_ROUND_TAB_NAME);
  await input.client.updateRange(input.spreadsheetId, `'${FOUR_FACTOR_ROUND_TAB_NAME}'!A1`, [Array.from(FOUR_FACTOR_ROUND_HEADER)]);
  // Settings row 10 is the stable v0.1 template-version row. Updating it only
  // after the new tab/header exists makes migration fail closed.
  await input.client.updateRange(input.spreadsheetId, "'설정'!B10", [["v0.2-four-factor-round"]]);
};

export const appendFourFactorRoundResult = async (input: { client: GoogleSheetsClient; spreadsheetId: string; round: PAPSAssessmentRound; result: PAPSStudentRoundResult }): Promise<void> => {
  await ensureFourFactorRoundSheet(input);
  const existing = await input.client.readRange(input.spreadsheetId, `'${FOUR_FACTOR_ROUND_TAB_NAME}'!A2:C10000`);
  const key = `${input.round.id}|${input.result.studentId}|${input.result.revision}`;
  if (existing.some((row) => `${row[0] ?? ""}|${row[1] ?? ""}|${row[2] ?? ""}` === key)) return;
  await input.client.appendRows(input.spreadsheetId, `'${FOUR_FACTOR_ROUND_TAB_NAME}'!A:AT`, [buildFourFactorRoundResultRow(input.round, input.result)]);
};
