import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "./template";

export type GoogleSheetCellValue = string | number | boolean | null;

export interface GoogleSheetTabPayload {
  tabName: string;
  header: string[];
  rows: GoogleSheetCellValue[][];
}

const normalizeCellValue = (value: GoogleSheetCellValue): string => {
  if (value === null) {
    return "";
  }

  return String(value);
};

const isGoogleSheetCellValue = (value: unknown): value is GoogleSheetCellValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const validateGoogleSheetTabPayloadShape = (input: unknown): GoogleSheetTabPayload[] => {
  if (!Array.isArray(input)) {
    throw new Error("Google Sheet tabs must be an array.");
  }

  return input.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Each Google Sheet tab must be an object.");
    }

    const candidate = entry as Partial<GoogleSheetTabPayload>;

    if (typeof candidate.tabName !== "string" || candidate.tabName.trim().length === 0) {
      throw new Error("Each Google Sheet tab must include a tabName.");
    }

    if (!Array.isArray(candidate.header)) {
      throw new Error("Each Google Sheet tab must include a header array.");
    }

    if (!Array.isArray(candidate.rows)) {
      throw new Error("Each Google Sheet tab must include a rows array.");
    }

    return {
      tabName: candidate.tabName,
      header: candidate.header.map((value) => {
        if (!isGoogleSheetCellValue(value)) {
          throw new Error("Google Sheet header values must be string, number, boolean, or null.");
        }

        return normalizeCellValue(value);
      }),
      rows: candidate.rows.map((row) => {
        if (!Array.isArray(row)) {
          throw new Error("Each Google Sheet row must be an array.");
        }

        return row.map((value) => {
          if (!isGoogleSheetCellValue(value)) {
            throw new Error("Google Sheet cell values must be string, number, boolean, or null.");
          }

          return value;
        });
      })
    };
  });
};

export const parseGoogleSheetTabPayloads = (input: unknown): GoogleSheetTabPayload[] => {
  return validateGoogleSheetTabPayloadShape(input);
};

export const assertGoogleSheetTabsMatchPrototype = (
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
