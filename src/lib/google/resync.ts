import { prepareGoogleSheetWriteRequest, type GoogleSheetTabPayload } from "./sheets";

export interface GoogleSheetResyncInput {
  spreadsheetId: string;
  tabs: GoogleSheetTabPayload[];
  triggeredByTeacherEmail: string;
  source?: "manual" | "file-store";
  dryRun?: boolean;
}

export interface GoogleSheetResyncPlan {
  spreadsheetId: string;
  source: "manual" | "file-store";
  dryRun: boolean;
  triggeredByTeacherEmail: string;
  preparedAt: string;
  request: ReturnType<typeof prepareGoogleSheetWriteRequest>;
  storeIntegration: "pending";
}

export const createGoogleSheetResyncPlan = (
  input: GoogleSheetResyncInput
): GoogleSheetResyncPlan => ({
  spreadsheetId: input.spreadsheetId,
  source: input.source ?? "manual",
  dryRun: input.dryRun ?? true,
  triggeredByTeacherEmail: input.triggeredByTeacherEmail,
  preparedAt: new Date().toISOString(),
  request: prepareGoogleSheetWriteRequest(input.spreadsheetId, input.tabs),
  storeIntegration: "pending"
});

export const resyncGoogleSheet = async (input: GoogleSheetResyncInput) => ({
  ok: true as const,
  stubbed: true as const,
  plan: createGoogleSheetResyncPlan(input)
});
