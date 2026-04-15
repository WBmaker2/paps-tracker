import type { PAPSClassroom, PAPSSchool, PAPSSession, PAPSTeacher } from "../paps/types";
import { createGoogleSheetsEditLink } from "./drive-link";

export const SETTINGS_MACHINE_ROW_LABELS = {
  school: "__PAPS_SCHOOL",
  connection: "__PAPS_CONNECTION",
  teacher: "__PAPS_TEACHER",
  teacherMeta: "__PAPS_TEACHER_META",
  class: "__PAPS_CLASS",
  classMeta: "__PAPS_CLASS_META",
  session: "__PAPS_SESSION",
  sessionMeta: "__PAPS_SESSION_META",
  sessionStatus: "__PAPS_SESSION_STATUS",
  sessionTarget: "__PAPS_SESSION_TARGET",
  legacySchool: "__PAPS_MACHINE_SCHOOL",
  legacyClasses: "__PAPS_MACHINE_CLASSES",
  legacyTeachers: "__PAPS_MACHINE_TEACHERS",
  legacySessions: "__PAPS_MACHINE_SESSIONS",
  legacySpreadsheetId: "__PAPS_MACHINE_SPREADSHEET_ID",
  legacySpreadsheetUrl: "__PAPS_MACHINE_SPREADSHEET_URL"
} as const;

export interface GoogleSheetStructuredSettings {
  school: PAPSSchool;
  teachers: PAPSTeacher[];
  hasPersistedTeachers: boolean;
  classes: PAPSClassroom[];
  sessions: PAPSSession[];
}

export interface ParseGoogleSheetStructuredSettingsInput {
  settingsRows: string[][];
  spreadsheetId: string;
  teacherEmail: string;
}

const toIsoNow = (): string => new Date().toISOString();

export const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const parseRowMap = (rows: string[][]): Map<string, string[][]> => {
  const map = new Map<string, string[][]>();

  for (const row of rows) {
    const label = row[0];

    if (!label) {
      continue;
    }

    const currentRows = map.get(label) ?? [];
    currentRows.push(row);
    map.set(label, currentRows);
  }

  return map;
};

const parseJsonCell = <T>(rowsByLabel: Map<string, string[][]>, label: string, fallback: T): T => {
  const cellValue = rowsByLabel.get(label)?.[0]?.[1];

  if (!cellValue) {
    return fallback;
  }

  try {
    return JSON.parse(cellValue) as T;
  } catch {
    return fallback;
  }
};

const parseTeacherName = (email: string): string => {
  const localPart = email.split("@")[0] ?? email;

  return localPart.replace(/[._-]+/g, " ").trim() || email;
};

export const normalizeIsoValue = (value?: string | null): string => {
  if (!value?.trim()) {
    return toIsoNow();
  }

  const trimmedValue = value.trim();

  if (trimmedValue.includes("T")) {
    return trimmedValue;
  }

  if (trimmedValue.includes(" ")) {
    return `${trimmedValue.replace(" ", "T")}.000Z`;
  }

  return `${trimmedValue}T00:00:00.000Z`;
};

const getHumanSettingValue = (rowsByLabel: Map<string, string[][]>, label: string): string | null =>
  rowsByLabel.get(label)?.[0]?.[1] ?? null;

const createDefaultSchool = (input: {
  spreadsheetId: string;
  schoolName?: string | null;
  sheetUrl?: string | null;
  teacherId: string;
}): PAPSSchool => {
  const timestamp = toIsoNow();

  return {
    id: `school-${input.spreadsheetId}`,
    name: input.schoolName?.trim() || "PAPS School",
    teacherIds: [input.teacherId],
    sheetUrl: input.sheetUrl?.trim() || createGoogleSheetsEditLink(input.spreadsheetId),
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const createDefaultTeacher = (input: {
  email: string;
  schoolId: string;
}): PAPSTeacher => {
  const timestamp = toIsoNow();

  return {
    id: createTeacherId(input.email),
    schoolId: input.schoolId,
    name: parseTeacherName(input.email),
    email: input.email,
    createdAt: timestamp,
    updatedAt: timestamp
  };
};

const buildStructuredSchool = (
  rowsByLabel: Map<string, string[][]>,
  spreadsheetId: string,
  teacherId: string
): PAPSSchool => {
  const schoolRow = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.school)?.[0];
  const connectionRow = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.connection)?.[0];
  const legacySchool = parseJsonCell<PAPSSchool | null>(
    rowsByLabel,
    SETTINGS_MACHINE_ROW_LABELS.legacySchool,
    null
  );

  if (schoolRow) {
    return {
      id: schoolRow[1] || `school-${spreadsheetId}`,
      name: schoolRow[2] || getHumanSettingValue(rowsByLabel, "학교명") || "PAPS School",
      teacherIds: [],
      sheetUrl:
        schoolRow[3] ||
        connectionRow?.[2] ||
        parseJsonCell<string | null>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.legacySpreadsheetUrl, null) ||
        getHumanSettingValue(rowsByLabel, "템플릿 안내 링크") ||
        createGoogleSheetsEditLink(spreadsheetId),
      createdAt: normalizeIsoValue(schoolRow[4]),
      updatedAt: normalizeIsoValue(schoolRow[5])
    };
  }

  return (
    legacySchool ??
    createDefaultSchool({
      spreadsheetId,
      schoolName: getHumanSettingValue(rowsByLabel, "학교명"),
      sheetUrl:
        parseJsonCell<string | null>(
          rowsByLabel,
          SETTINGS_MACHINE_ROW_LABELS.legacySpreadsheetUrl,
          null
        ) ?? getHumanSettingValue(rowsByLabel, "템플릿 안내 링크"),
      teacherId
    })
  );
};

const buildStructuredTeachers = (
  rowsByLabel: Map<string, string[][]>,
  schoolId: string,
  teacherEmail: string
): {
  teachers: PAPSTeacher[];
  hasPersistedTeachers: boolean;
} => {
  const teacherRows = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.teacher) ?? [];
  const teacherMetaById = new Map(
    (rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.teacherMeta) ?? []).map((row) => [row[1], row])
  );

  const legacyTeachers = parseJsonCell<PAPSTeacher[]>(
    rowsByLabel,
    SETTINGS_MACHINE_ROW_LABELS.legacyTeachers,
    []
  );
  const hasPersistedTeachers = teacherRows.length > 0 || legacyTeachers.length > 0;
  let teachers =
    teacherRows.length > 0
      ? teacherRows.map((row) => {
          const metaRow = teacherMetaById.get(row[1] ?? "");

          return {
            id: row[1] || createTeacherId(row[4] || teacherEmail),
            schoolId: row[2] || schoolId,
            name: row[3] || parseTeacherName(row[4] || teacherEmail),
            email: row[4] || teacherEmail,
            createdAt: normalizeIsoValue(metaRow?.[2]),
            updatedAt: normalizeIsoValue(metaRow?.[3])
          } satisfies PAPSTeacher;
        })
      : legacyTeachers;

  if (teachers.length === 0) {
    teachers = [createDefaultTeacher({ email: teacherEmail, schoolId })];
  }

  if (
    !hasPersistedTeachers &&
    !teachers.some(
      (teacher) => teacher.email.trim().toLowerCase() === teacherEmail.trim().toLowerCase()
    )
  ) {
    teachers = [...teachers, createDefaultTeacher({ email: teacherEmail, schoolId })];
  }

  return {
    teachers,
    hasPersistedTeachers
  };
};

const buildStructuredClasses = (
  rowsByLabel: Map<string, string[][]>,
  schoolId: string
): PAPSClassroom[] => {
  const classRows = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.class) ?? [];
  const classMetaById = new Map(
    (rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.classMeta) ?? []).map((row) => [row[1], row])
  );

  if (classRows.length > 0) {
    return classRows.map((row) => {
      const metaRow = classMetaById.get(row[1] ?? "");

      return {
        id: row[1]!,
        schoolId: row[2] || schoolId,
        academicYear: Number(row[3]) || new Date().getUTCFullYear(),
        gradeLevel: Number(row[4]) as PAPSClassroom["gradeLevel"],
        classNumber: Number(row[5]) || 1,
        label: metaRow?.[2] || `${row[4]}-${row[5]}`,
        active: (metaRow?.[3] ?? "Y") !== "N"
      } satisfies PAPSClassroom;
    });
  }

  return parseJsonCell<PAPSClassroom[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.legacyClasses, []);
};

const buildStructuredSessions = (rowsByLabel: Map<string, string[][]>): PAPSSession[] => {
  const sessionRows = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.session) ?? [];
  const sessionMetaById = new Map(
    (rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.sessionMeta) ?? []).map((row) => [row[1], row])
  );
  const sessionStatusById = new Map(
    (rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.sessionStatus) ?? []).map((row) => [row[1], row])
  );
  const sessionTargetsById = new Map<string, PAPSSession["classTargets"]>();

  for (const row of rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.sessionTarget) ?? []) {
    const sessionId = row[1];

    if (!sessionId) {
      continue;
    }

    const currentTargets = sessionTargetsById.get(sessionId) ?? [];
    currentTargets.push({
      classId: row[2] ?? "",
      eventId: (row[3] as PAPSSession["eventId"]) ?? "sit-and-reach"
    });
    sessionTargetsById.set(sessionId, currentTargets);
  }

  if (sessionRows.length > 0) {
    return sessionRows.map((row) => {
      const metaRow = sessionMetaById.get(row[1] ?? "");
      const statusRow = sessionStatusById.get(row[1] ?? "");

      return {
        id: row[1]!,
        schoolId: row[2] || undefined,
        teacherId: row[3] || undefined,
        academicYear: Number(row[4]) || undefined,
        name: row[5] || undefined,
        gradeLevel: Number(metaRow?.[2]) as PAPSSession["gradeLevel"],
        sessionType: (metaRow?.[3] as PAPSSession["sessionType"]) ?? "practice",
        classScope: (metaRow?.[4] as PAPSSession["classScope"]) ?? "single",
        eventId: (metaRow?.[5] as PAPSSession["eventId"]) ?? "sit-and-reach",
        classTargets: sessionTargetsById.get(row[1]!) ?? [],
        isOpen: (statusRow?.[2] ?? "Y") !== "N",
        createdAt: normalizeIsoValue(statusRow?.[3])
      } satisfies PAPSSession;
    });
  }

  return parseJsonCell<PAPSSession[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.legacySessions, []);
};

export const parseGoogleSheetStructuredSettings = ({
  settingsRows,
  spreadsheetId,
  teacherEmail
}: ParseGoogleSheetStructuredSettingsInput): GoogleSheetStructuredSettings => {
  const rowsByLabel = parseRowMap(settingsRows);
  const teacherId = createTeacherId(teacherEmail);
  const school = buildStructuredSchool(rowsByLabel, spreadsheetId, teacherId);
  const teacherState = buildStructuredTeachers(rowsByLabel, school.id, teacherEmail);
  const classes = buildStructuredClasses(rowsByLabel, school.id);
  const sessions = buildStructuredSessions(rowsByLabel);
  const connectedSpreadsheetId =
    rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.connection)?.[0]?.[1] ??
    parseJsonCell<string | null>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.legacySpreadsheetId, null) ??
    spreadsheetId;

  return {
    school: {
      ...school,
      teacherIds: Array.from(new Set(teacherState.teachers.map((teacher) => teacher.id))),
      sheetUrl: school.sheetUrl ?? createGoogleSheetsEditLink(connectedSpreadsheetId)
    },
    teachers: teacherState.teachers,
    hasPersistedTeachers: teacherState.hasPersistedTeachers,
    classes,
    sessions
  };
};
