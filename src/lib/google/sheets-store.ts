import type { NextRequest } from "next/server";

import type { PAPSSchool } from "../paps/types";
import { createSchoolStoreForRequest, createStoreForRequest } from "../store/paps-store";
import type { TeacherBootstrap } from "../store/paps-store-types";
import {
  GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR,
  type TeacherSheetStatus
} from "./sheet-connection-status";
import {
  createGoogleSheetClientFromEnv,
  createGoogleSheetsStoreForRequest
} from "./sheet-store-factory";
import type {
  TeacherCrudStore,
  TeacherSchoolStore
} from "./sheet-store-types";
import {
  getDisconnectedTeacherBootstrap,
  loadTeacherPageStateWithResolvers,
  resolveStoreWithSpreadsheetId
} from "./sheet-runtime-context";
import {
  connectGoogleSheetForTeacher,
  type ConnectTeacherGoogleSheetInput
} from "./sheet-connect";

export const PAPS_SPREADSHEET_ID_COOKIE = "paps-spreadsheet-id";

export const createTeacherRuntimeStoreForRequest = async (
  request: NextRequest,
  teacherEmail: string
): Promise<TeacherCrudStore> =>
  resolveStoreWithSpreadsheetId({
    spreadsheetId: request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null,
    teacherEmail,
    testStoreFactory: createStoreForRequest,
    connectedStoreFactory: createGoogleSheetsStoreForRequest
  }) as Promise<TeacherCrudStore>;

export const createTeacherSchoolRuntimeStoreForRequest = async (
  request: NextRequest,
  teacherEmail: string
): Promise<TeacherSchoolStore> =>
  resolveStoreWithSpreadsheetId({
    spreadsheetId: request.cookies.get(PAPS_SPREADSHEET_ID_COOKIE)?.value ?? null,
    teacherEmail,
    testStoreFactory: createSchoolStoreForRequest,
    connectedStoreFactory: createGoogleSheetsStoreForRequest
  }) as Promise<TeacherSchoolStore>;

export const loadTeacherPageState = async ({
  teacherEmail,
  spreadsheetId
}: {
  teacherEmail: string;
  spreadsheetId: string | null | undefined;
}): Promise<{
  store: TeacherCrudStore | null;
  bootstrap: TeacherBootstrap;
  sheetConnected: boolean;
  sheetStatus: TeacherSheetStatus;
}> =>
  loadTeacherPageStateWithResolvers({
    teacherEmail,
    spreadsheetId,
    createTestStore: createStoreForRequest,
    createConnectedStore: createGoogleSheetsStoreForRequest
  });

export const connectTeacherGoogleSheet = async (
  input: ConnectTeacherGoogleSheetInput
): Promise<{ school: PAPSSchool; spreadsheetId: string; normalizedUrl: string }> =>
  connectGoogleSheetForTeacher({
    ...input,
    client: input.client ?? createGoogleSheetClientFromEnv()
  });

export {
  GOOGLE_SHEET_SERVICE_ACCOUNT_ERROR,
  createGoogleSheetClientFromEnv,
  createGoogleSheetsStoreForRequest,
  getDisconnectedTeacherBootstrap
};
export type {
  CreateGoogleSheetsStoreForRequestInput,
  TeacherCrudStore,
  TeacherSchoolStore,
  TeacherSheetsStore
} from "./sheet-store-types";
