export interface ParsedGoogleSheetsUrl {
  spreadsheetId: string;
  gid: string | null;
  isCopyLink: boolean;
  normalizedUrl: string;
}

export type GoogleSheetsValidationResult =
  | {
      ok: true;
      value: ParsedGoogleSheetsUrl;
    }
  | {
      ok: false;
      error: string;
    };

const createInvalidSheetsUrlError = (message: string): Error => new Error(message);

const extractSpreadsheetPath = (pathname: string): {
  spreadsheetId: string;
  action: string;
} | null => {
  const segments = pathname.split("/").filter(Boolean);
  const spreadsheetsIndex = segments.indexOf("spreadsheets");
  const idIndex = segments.indexOf("d");

  if (spreadsheetsIndex !== 0 || idIndex === -1 || idIndex + 1 >= segments.length) {
    return null;
  }

  return {
    spreadsheetId: segments[idIndex + 1],
    action: segments[idIndex + 2] ?? "edit"
  };
};

const getNormalizedSheetsUrl = ({
  spreadsheetId,
  gid,
  isCopyLink
}: Omit<ParsedGoogleSheetsUrl, "normalizedUrl">): string => {
  const action = isCopyLink ? "copy" : "edit";
  const hash = gid ? `#gid=${gid}` : "";

  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/${action}${hash}`;
};

export const parseGoogleSheetsUrl = (input: string): ParsedGoogleSheetsUrl => {
  let url: URL;

  try {
    url = new URL(input);
  } catch {
    throw createInvalidSheetsUrlError("Google Sheets URL must be a valid URL.");
  }

  if (url.hostname !== "docs.google.com") {
    throw createInvalidSheetsUrlError("Google Sheets URL must point to docs.google.com.");
  }

  const path = extractSpreadsheetPath(url.pathname);

  if (!path) {
    throw createInvalidSheetsUrlError("Google Sheets URL must point to a spreadsheet.");
  }

  const isCopyLink = path.action === "copy";
  const isEditableShareLink = path.action === "edit" || path.action === "view";

  if (!isEditableShareLink && !isCopyLink) {
    throw createInvalidSheetsUrlError("Google Sheets URL must point to a spreadsheet.");
  }

  const gid = url.hash.startsWith("#gid=") ? url.hash.slice("#gid=".length) : null;

  return {
    spreadsheetId: path.spreadsheetId,
    gid,
    isCopyLink,
    normalizedUrl: getNormalizedSheetsUrl({
      spreadsheetId: path.spreadsheetId,
      gid,
      isCopyLink
    })
  };
};

export const validateGoogleSheetsUrl = (input: string): GoogleSheetsValidationResult => {
  try {
    return {
      ok: true,
      value: parseGoogleSheetsUrl(input)
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Google Sheets URL is invalid."
    };
  }
};

export const createGoogleSheetsCopyLink = (
  input: Pick<ParsedGoogleSheetsUrl, "spreadsheetId">
): string => getNormalizedSheetsUrl({ spreadsheetId: input.spreadsheetId, gid: null, isCopyLink: true });
