import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "./template";
import { FOUR_FACTOR_ROUND_HEADER, FOUR_FACTOR_ROUND_TAB_NAME } from "./four-factor-round-sheet";
import { PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION } from "./template";
import type { GoogleSheetTabPayload } from "./sheets";
import type { GoogleSheetsClient, GoogleSpreadsheetMetadata } from "./sheets-client";

export interface PapsGoogleSheetValidationResult {
  spreadsheet: GoogleSpreadsheetMetadata;
  templateVersion: string;
}

const escapeTabName = (tabName: string): string => tabName.replace(/'/g, "''");

const getSettingsVersionRow = (rows: string[][]): string[] | null =>
  rows.find((row) => row[0] === PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL) ?? null;

export const assertPapsGoogleSheetTabsMatchPrototype = (
  tabs: GoogleSheetTabPayload[]
): GoogleSheetTabPayload[] => {
  if (tabs.length !== PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.length) {
    throw new Error("Manual Google Sheet tabs must match the prototype tab contract.");
  }

  tabs.forEach((tab, index) => {
    const prototypeTab = PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[index];

    if (!prototypeTab) {
      throw new Error("Manual Google Sheet tabs must match the prototype tab contract.");
    }

    if (tab.tabName !== prototypeTab.tabName) {
      throw new Error("Manual Google Sheet tabs must match the prototype tab order and names.");
    }

    if (
      tab.header.length !== prototypeTab.header.length ||
      tab.header.some((value, headerIndex) => value !== prototypeTab.header[headerIndex])
    ) {
      throw new Error(`Manual Google Sheet tab ${tab.tabName} must use the prototype header.`);
    }
  });

  return tabs;
};

export const assertPapsGoogleSheetTemplateVersion = (value: string): string => {
  if (value !== PAPS_GOOGLE_SHEET_TEMPLATE_VERSION) {
    throw new Error(
      `Google Sheets template version ${value} does not match ${PAPS_GOOGLE_SHEET_TEMPLATE_VERSION}.`
    );
  }

  return value;
};

export const validatePapsGoogleSheetTemplate = async (
  client: GoogleSheetsClient,
  spreadsheetId: string
): Promise<PapsGoogleSheetValidationResult> => {
  const spreadsheet = await client.getSpreadsheet(spreadsheetId);
  const expectedTabNames = PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab) => tab.tabName);
  const actualTabNames = spreadsheet.sheets.map((sheet) => sheet.properties.title);

  const isLegacy = actualTabNames.length === expectedTabNames.length && actualTabNames.every((tabName, index) => tabName === expectedTabNames[index]);
  const isCurrent = actualTabNames.length === expectedTabNames.length + 1 && actualTabNames.slice(0, expectedTabNames.length).every((tabName, index) => tabName === expectedTabNames[index]) && actualTabNames.at(-1) === FOUR_FACTOR_ROUND_TAB_NAME;
  if (!isLegacy && !isCurrent) {
    throw new Error("Google Sheets spreadsheet tabs must match the PAPS prototype tabs.");
  }

  const tabPayloads = await Promise.all(
    PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map(async (prototypeTab) => {
      const rows = await client.readRange(
        spreadsheetId,
        `'${escapeTabName(prototypeTab.tabName)}'!A1:Z1`
      );

      return {
        tabName: prototypeTab.tabName,
        header: rows[0] ?? [],
        rows: []
      };
    })
  );

  assertPapsGoogleSheetTabsMatchPrototype(tabPayloads);

  if (isCurrent) {
    const roundHeader = await client.readRange(spreadsheetId, `'${FOUR_FACTOR_ROUND_TAB_NAME}'!A1:AT1`);
    if ((roundHeader[0] ?? []).join("\u0001") !== FOUR_FACTOR_ROUND_HEADER.join("\u0001")) {
      throw new Error("Google Sheets four-factor round header does not match.");
    }
  }

  const settingsRows = await client.readRange(spreadsheetId, `'설정'!A1:C20`);
  const versionRow = getSettingsVersionRow(settingsRows);

  if (!versionRow) {
    throw new Error("Google Sheets template version row was not found.");
  }

  const version = versionRow[1] ?? "";
  if ((isLegacy && version !== PAPS_GOOGLE_SHEET_TEMPLATE_VERSION) || (isCurrent && version !== PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION)) {
    throw new Error(`Google Sheets template version ${version} does not match ${isCurrent ? PAPS_GOOGLE_SHEET_FOUR_FACTOR_TEMPLATE_VERSION : PAPS_GOOGLE_SHEET_TEMPLATE_VERSION}.`);
  }

  return {
    spreadsheet,
    templateVersion: version
  };
};
