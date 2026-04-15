import { createGoogleSheetClientFromEnv } from "./sheets-store";
import type { GoogleSheetsClient } from "./sheets-client";
import {
  executeGoogleSheetTabWrite,
  prepareGoogleSheetWriteRequest
} from "./sheet-tab-write";
import type { GoogleSheetTabPayload } from "./sheets";

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
}

export const createGoogleSheetResyncPlan = (
  input: GoogleSheetResyncInput
): GoogleSheetResyncPlan => ({
  spreadsheetId: input.spreadsheetId,
  source: input.source ?? "manual",
  dryRun: input.dryRun ?? true,
  triggeredByTeacherEmail: input.triggeredByTeacherEmail,
  preparedAt: new Date().toISOString(),
  request: prepareGoogleSheetWriteRequest(input.spreadsheetId, input.tabs)
});

export const resyncGoogleSheet = async (
  input: GoogleSheetResyncInput,
  client?: GoogleSheetsClient
) => {
  const plan = createGoogleSheetResyncPlan(input);
  const writeResult = await executeGoogleSheetTabWrite({
    spreadsheetId: input.spreadsheetId,
    tabs: input.tabs,
    dryRun: plan.dryRun,
    client: plan.dryRun ? client : client ?? createGoogleSheetClientFromEnv()
  });

  return {
    ok: true as const,
    source: plan.source,
    triggeredByTeacherEmail: plan.triggeredByTeacherEmail,
    preparedAt: plan.preparedAt,
    dryRun: writeResult.dryRun,
    request: writeResult.request,
    updatedTabs: writeResult.updatedTabs
  };
};
