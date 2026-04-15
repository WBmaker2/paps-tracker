import type {
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSStoredAttempt,
  PAPSStudent,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord
} from "../paps/types";
import { buildDerivedGoogleSheetTabPayloads } from "./sheet-derived-tab-payloads";
import { buildSettingsTabValues, buildStudentTabValues } from "./sheet-source-tab-values";
export type { GoogleSheetCellValue, GoogleSheetTabPayload } from "./sheet-tab-contract";
export {
  assertGoogleSheetTabsMatchPrototype,
  parseGoogleSheetTabPayloads
} from "./sheet-tab-contract";
import type { GoogleSheetTabPayload } from "./sheet-tab-contract";
export type {
  PreparedGoogleSheetTabWrite,
  PreparedGoogleSheetWriteRequest
} from "./sheet-tab-write";
export {
  executeGoogleSheetTabWrite,
  prepareGoogleSheetTabWrite,
  prepareGoogleSheetWriteRequest,
  writeGoogleSheetTabs
} from "./sheet-tab-write";

export interface PapsGoogleSheetSnapshot {
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  students: PAPSStudent[];
  sessions: PAPSSession[];
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
}

const toSexLabel = (sex: PAPSStudent["sex"]): string => (sex === "male" ? "남" : "여");

const toActiveLabel = (active?: boolean): string => (active === false ? "N" : "Y");

export const createPapsGoogleSheetTabPayloads = ({
  school,
  classes,
  teachers,
  students,
  sessions,
  attempts,
  syncStatuses,
  syncErrorLogs,
  representativeSelectionAuditLogs
}: PapsGoogleSheetSnapshot): GoogleSheetTabPayload[] => {
  const settingsTab = {
    tabName: "설정",
    header: buildSettingsTabValues({
      spreadsheetId: school.sheetUrl?.split("/d/")[1]?.split("/")[0] ?? school.id,
      school,
      classes,
      teachers,
      sessions
    })[0]!,
    rows: buildSettingsTabValues({
      spreadsheetId: school.sheetUrl?.split("/d/")[1]?.split("/")[0] ?? school.id,
      school,
      classes,
      teachers,
      sessions
    }).slice(1)
  };
  const studentsTab = {
    tabName: "학생명단",
    header: buildStudentTabValues({
      students,
      classes
    })[0]!,
    rows: buildStudentTabValues({
      students,
      classes
    }).slice(1)
  };
  const derivedTabs = buildDerivedGoogleSheetTabPayloads({
    classes,
    teachers,
    students,
    sessions,
    attempts,
    syncStatuses,
    syncErrorLogs,
    representativeSelectionAuditLogs
  });

  return [settingsTab, studentsTab, ...derivedTabs];
};
