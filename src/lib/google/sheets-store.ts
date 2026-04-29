import type { NextRequest } from "next/server";

import type { PAPSClassroom, PAPSSchool } from "../paps/types";
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
export const PAPS_SPREADSHEET_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const createPapsSpreadsheetIdCookieOptions = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: PAPS_SPREADSHEET_ID_COOKIE_MAX_AGE_SECONDS,
  secure: process.env.NODE_ENV === "production"
});

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
): Promise<{
  school: PAPSSchool;
  classes: PAPSClassroom[];
  spreadsheetId: string;
  normalizedUrl: string;
}> =>
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
