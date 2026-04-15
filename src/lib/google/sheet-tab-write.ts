import type { GoogleSheetsClient } from "./sheets-client";
import type { GoogleSheetCellValue, GoogleSheetTabPayload } from "./sheets";

export interface PreparedGoogleSheetTabWrite {
  tabName: string;
  range: string;
  values: string[][];
}

export interface PreparedGoogleSheetWriteRequest {
  spreadsheetId: string;
  valueInputOption: "USER_ENTERED";
  data: PreparedGoogleSheetTabWrite[];
}

const escapeTabName = (tabName: string): string => tabName.replace(/'/g, "''");

const normalizeCellValue = (value: GoogleSheetCellValue): string => {
  if (value === null) {
    return "";
  }

  return String(value);
};

export const prepareGoogleSheetTabWrite = (
  payload: GoogleSheetTabPayload
): PreparedGoogleSheetTabWrite => ({
  tabName: payload.tabName,
  range: `'${escapeTabName(payload.tabName)}'!A1`,
  values: [payload.header, ...payload.rows].map((row) => row.map(normalizeCellValue))
});

export const prepareGoogleSheetWriteRequest = (
  spreadsheetId: string,
  tabs: GoogleSheetTabPayload[]
): PreparedGoogleSheetWriteRequest => ({
  spreadsheetId,
  valueInputOption: "USER_ENTERED",
  data: tabs.map(prepareGoogleSheetTabWrite)
});

export const writeGoogleSheetTabs = async (input: {
  spreadsheetId: string;
  tabs: GoogleSheetTabPayload[];
  dryRun?: boolean;
}): Promise<{
  ok: true;
  dryRun: boolean;
  request: PreparedGoogleSheetWriteRequest;
  updatedTabs: string[];
}> => ({
  ok: true,
  dryRun: input.dryRun ?? false,
  request: prepareGoogleSheetWriteRequest(input.spreadsheetId, input.tabs),
  updatedTabs: []
});

export const executeGoogleSheetTabWrite = async (input: {
  spreadsheetId: string;
  tabs: GoogleSheetTabPayload[];
  client?: GoogleSheetsClient;
  dryRun?: boolean;
}): Promise<{
  ok: true;
  dryRun: boolean;
  request: PreparedGoogleSheetWriteRequest;
  updatedTabs: string[];
}> => {
  const request = prepareGoogleSheetWriteRequest(input.spreadsheetId, input.tabs);

  if (input.dryRun ?? false) {
    return {
      ok: true,
      dryRun: true,
      request,
      updatedTabs: []
    };
  }

  if (!input.client) {
    throw new Error("Google Sheets client is required for write execution.");
  }

  for (const tab of request.data) {
    await input.client.updateRange(input.spreadsheetId, tab.range, tab.values);
  }

  return {
    ok: true,
    dryRun: false,
    request,
    updatedTabs: request.data.map((tab) => tab.tabName)
  };
};
