import { JWT } from "google-auth-library";

export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type GoogleSheetsCellValue = string | number | boolean | null;

export interface GoogleSheetsSheetMetadata {
  properties: {
    sheetId: number;
    title: string;
    index?: number;
    hidden?: boolean;
  };
}

export interface GoogleSpreadsheetMetadata {
  spreadsheetId: string;
  properties?: {
    title?: string;
  };
  sheets: GoogleSheetsSheetMetadata[];
}

export interface GoogleSheetsValuesResponse {
  range?: string;
  majorDimension?: string;
  values?: string[][];
}

export interface GoogleSheetsMutationResponse {
  spreadsheetId?: string;
  tableRange?: string;
  updates?: {
    spreadsheetId?: string;
    updatedRange?: string;
    updatedRows?: number;
    updatedColumns?: number;
    updatedCells?: number;
  };
}

export class GoogleSheetsAccessError extends Error {
  readonly status: number;
  readonly spreadsheetId: string;
  readonly operation: "read" | "write" | "access";

  constructor(spreadsheetId: string, status: number, operation: "read" | "write" | "access" = "access") {
    super(`The service account cannot access spreadsheet ${spreadsheetId}.`);
    this.name = "GoogleSheetsAccessError";
    this.status = status;
    this.spreadsheetId = spreadsheetId;
    this.operation = operation;
  }
}

export class GoogleSheetsApiDisabledError extends Error {
  readonly status: number;
  readonly spreadsheetId: string;
  readonly service: string | null;
  readonly projectId: string | null;

  constructor(input: {
    spreadsheetId: string;
    status: number;
    service?: string | null;
    projectId?: string | null;
  }) {
    const serviceLabel =
      input.service === "sheets.googleapis.com" || !input.service
        ? "Google Sheets API"
        : input.service;
    const projectSuffix = input.projectId ? ` (${input.projectId})` : "";

    super(`${serviceLabel} is disabled in the Google Cloud project${projectSuffix}. Enable it and try again.`);
    this.name = "GoogleSheetsApiDisabledError";
    this.status = input.status;
    this.spreadsheetId = input.spreadsheetId;
    this.service = input.service ?? null;
    this.projectId = input.projectId ?? null;
  }
}

export interface GoogleSheetsClientOptions {
  serviceAccountEmail: string;
  serviceAccountPrivateKey: string;
  fetchImpl?: typeof fetch;
  accessTokenProvider?: () => Promise<string>;
}

export interface GoogleSheetsClient {
  getSpreadsheet(spreadsheetId: string): Promise<GoogleSpreadsheetMetadata>;
  readRange(spreadsheetId: string, range: string): Promise<string[][]>;
  appendRows(spreadsheetId: string, range: string, values: GoogleSheetsCellValue[][]): Promise<GoogleSheetsMutationResponse>;
  updateRange(spreadsheetId: string, range: string, values: GoogleSheetsCellValue[][]): Promise<GoogleSheetsMutationResponse>;
}

const API_BASE_URL = "https://sheets.googleapis.com/v4";

const escapeRange = (range: string): string => encodeURIComponent(range);

const readResponseText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const readErrorMessage = async (response: Response): Promise<string | null> => {
  const text = await readResponseText(response);

  if (!text) {
    return null;
  }

  try {
    const parsed = JSON.parse(text) as {
      error?: {
        message?: string;
      };
    };

    return parsed.error?.message ?? text;
  } catch {
    return text;
  }
};

const parseServiceDisabledMetadata = (
  text: string
): {
  service: string | null;
  projectId: string | null;
} | null => {
  try {
    const parsed = JSON.parse(text) as {
      error?: {
        status?: string;
        details?: Array<{
          "@type"?: string;
          reason?: string;
          metadata?: {
            service?: string;
            consumer?: string;
            containerInfo?: string;
          };
        }>;
      };
    };

    const detail =
      parsed.error?.details?.find(
        (entry) =>
          entry.reason === "SERVICE_DISABLED" ||
          entry.metadata?.service === "sheets.googleapis.com"
      ) ?? null;

    const projectId =
      detail?.metadata?.consumer?.replace(/^projects\//, "") ??
      detail?.metadata?.containerInfo ??
      null;

    if (!detail && parsed.error?.status !== "PERMISSION_DENIED") {
      return null;
    }

    return {
      service: detail?.metadata?.service ?? null,
      projectId
    };
  } catch {
    return null;
  }
};

const createJwtAccessTokenProvider = ({
  serviceAccountEmail,
  serviceAccountPrivateKey
}: Pick<GoogleSheetsClientOptions, "serviceAccountEmail" | "serviceAccountPrivateKey">) => {
  const jwt = new JWT({
    email: serviceAccountEmail,
    key: serviceAccountPrivateKey,
    scopes: [GOOGLE_SHEETS_SCOPE]
  });

  return async (): Promise<string> => {
    const credentials = await jwt.authorize();
    const accessToken = credentials.access_token;

    if (!accessToken) {
      throw new Error("Google Sheets service account did not return an access token.");
    }

    return accessToken;
  };
};

const normalizeSheetResponse = <T extends { values?: string[][] }>(payload: T): string[][] =>
  payload.values?.map((row) => row.map((cell) => String(cell))) ?? [];

export const createGoogleSheetsClient = (
  options: GoogleSheetsClientOptions
): GoogleSheetsClient => {
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessTokenProvider = options.accessTokenProvider ?? createJwtAccessTokenProvider(options);

  const getAccessToken = async (): Promise<string> => {
    return accessTokenProvider();
  };

  const request = async <T>(
    url: string,
    init: RequestInit,
    spreadsheetId: string,
    responseParser: (response: Response) => Promise<T>
  ): Promise<T> => {
    const response = await fetchImpl(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        Accept: "application/json",
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      const text = await readResponseText(response);
      const message = text ? await (async () => {
        try {
          const parsed = JSON.parse(text) as {
            error?: {
              message?: string;
            };
          };

          return parsed.error?.message ?? text;
        } catch {
          return text;
        }
      })() : null;

      const serviceDisabledMetadata = text ? parseServiceDisabledMetadata(text) : null;

      if (
        response.status === 403 &&
        (message?.includes("Google Sheets API has not been used in project") ||
          message?.includes("SERVICE_DISABLED") ||
          serviceDisabledMetadata?.service === "sheets.googleapis.com")
      ) {
        throw new GoogleSheetsApiDisabledError({
          spreadsheetId,
          status: response.status,
          service: serviceDisabledMetadata?.service,
          projectId: serviceDisabledMetadata?.projectId
        });
      }

      if (response.status === 401 || response.status === 403 || response.status === 404) {
        throw new GoogleSheetsAccessError(spreadsheetId, response.status, init.method === "GET" ? "read" : "write");
      }

      throw new Error(message ?? `Google Sheets request failed with status ${response.status}.`);
    }

    return responseParser(response);
  };

  const getSpreadsheet = async (spreadsheetId: string): Promise<GoogleSpreadsheetMetadata> => {
    const url = `${API_BASE_URL}/spreadsheets/${spreadsheetId}?includeGridData=false`;

    return request(
      url,
      { method: "GET" },
      spreadsheetId,
      async (response) => (await response.json()) as GoogleSpreadsheetMetadata
    );
  };

  const readRange = async (spreadsheetId: string, range: string): Promise<string[][]> => {
    const url = `${API_BASE_URL}/spreadsheets/${spreadsheetId}/values/${escapeRange(range)}`;

    return request(
      url,
      { method: "GET" },
      spreadsheetId,
      async (response) => normalizeSheetResponse((await response.json()) as GoogleSheetsValuesResponse)
    );
  };

  const appendRows = async (
    spreadsheetId: string,
    range: string,
    values: GoogleSheetsCellValue[][]
  ): Promise<GoogleSheetsMutationResponse> => {
    const url = `${API_BASE_URL}/spreadsheets/${spreadsheetId}/values/${escapeRange(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    return request(
      url,
      {
        method: "POST",
        body: JSON.stringify({ values }),
        headers: {
          "content-type": "application/json"
        }
      },
      spreadsheetId,
      async (response) => (await response.json()) as GoogleSheetsMutationResponse
    );
  };

  const updateRange = async (
    spreadsheetId: string,
    range: string,
    values: GoogleSheetsCellValue[][]
  ): Promise<GoogleSheetsMutationResponse> => {
    const url = `${API_BASE_URL}/spreadsheets/${spreadsheetId}/values/${escapeRange(range)}?valueInputOption=USER_ENTERED`;

    return request(
      url,
      {
        method: "PUT",
        body: JSON.stringify({ values }),
        headers: {
          "content-type": "application/json"
        }
      },
      spreadsheetId,
      async (response) => (await response.json()) as GoogleSheetsMutationResponse
    );
  };

  return {
    getSpreadsheet,
    readRange,
    appendRows,
    updateRange
  };
};
