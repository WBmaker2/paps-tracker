import { PAPS_EVENT_DEFINITIONS } from "../../data/paps/events";
import type { TeacherBootstrap } from "../store/paps-store-types";
import type {
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncState,
  PAPSSyncStatusRecord,
  PAPSStoredAttempt,
  PAPSStudent
} from "../paps/types";
import { createGoogleSheetsEditLink } from "./drive-link";
import type { GoogleSheetsClient } from "./sheets-client";
import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "./template";

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

export interface GoogleSheetStructuredState {
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  sessions: PAPSSession[];
  allStudents: PAPSStudent[];
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
}

export interface BuildTeacherBootstrapFromSheetInput {
  client: GoogleSheetsClient;
  spreadsheetId: string;
  teacherEmail: string;
}

const SETTINGS_RANGE = "'설정'!A2:F200";
const STUDENTS_RANGE = "'학생명단'!A2:I1000";
const RECORDS_RANGE = "'세션기록'!A2:U5000";
const ERRORS_RANGE = "'오류로그'!A2:G2000";
const AUDITS_RANGE = "'수정로그'!A2:I2000";

const toIsoNow = (): string => new Date().toISOString();

const createTeacherId = (email: string): string =>
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

const parseSex = (value: string): PAPSStudent["sex"] => (value === "남" ? "male" : "female");

const parseActive = (value: string): boolean => value !== "N";

const normalizeIsoValue = (value?: string | null): string => {
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

const parseSyncStatus = (value?: string | null): PAPSSyncState | null => {
  switch (value?.trim()) {
    case "대기":
    case "대기 중":
    case "pending":
      return "pending";
    case "완료":
    case "동기화 완료":
    case "synced":
      return "synced";
    case "실패":
    case "동기화 실패":
    case "failed":
      return "failed";
    default:
      return null;
  }
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

const parseStudents = (rows: string[][], classes: PAPSClassroom[], schoolId: string): PAPSStudent[] => {
  const classByIdentity = new Map(
    classes.map((classroom) => [
      `${classroom.academicYear}:${classroom.gradeLevel}:${classroom.classNumber}`,
      classroom
    ])
  );

  return rows
    .filter((row) => row[0] && row[5])
    .map((row) => {
      const academicYear = Number(row[1]) || new Date().getUTCFullYear();
      const gradeLevel = Number(row[2]) as PAPSStudent["gradeLevel"];
      const classNumber = Number(row[3]);
      const classroom =
        classByIdentity.get(`${academicYear}:${gradeLevel}:${classNumber}`) ??
        classes.find(
          (entry) => entry.gradeLevel === gradeLevel && entry.classNumber === classNumber
        ) ??
        null;

      return {
        id: row[0]!,
        schoolId,
        classId: classroom?.id ?? `class-${academicYear}-${gradeLevel}-${classNumber}`,
        studentNumber: Number(row[4]) || undefined,
        name: row[5]!,
        sex: parseSex(row[6] ?? "여"),
        gradeLevel,
        active: parseActive(row[7] ?? "Y")
      } satisfies PAPSStudent;
    });
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
): PAPSTeacher[] => {
  const teacherRows = rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.teacher) ?? [];
  const teacherMetaById = new Map(
    (rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.teacherMeta) ?? []).map((row) => [row[1], row])
  );

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
      : parseJsonCell<PAPSTeacher[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.legacyTeachers, []);

  if (teachers.length === 0) {
    teachers = [createDefaultTeacher({ email: teacherEmail, schoolId })];
  }

  if (
    !teachers.some(
      (teacher) => teacher.email.trim().toLowerCase() === teacherEmail.trim().toLowerCase()
    )
  ) {
    teachers = [...teachers, createDefaultTeacher({ email: teacherEmail, schoolId })];
  }

  return teachers;
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

const buildStructuredSessions = (
  rowsByLabel: Map<string, string[][]>
): PAPSSession[] => {
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

const buildEventIdByLabel = (): Map<string, PAPSSession["eventId"]> => {
  const map = new Map<string, PAPSSession["eventId"]>();

  for (const eventDefinition of Object.values(PAPS_EVENT_DEFINITIONS)) {
    map.set(eventDefinition.label, eventDefinition.id);
  }

  map.set("앉아윗몸앞으로굽히기", "sit-and-reach");
  map.set("왕복오래달리기", "shuttle-run");
  map.set("오래달리기-걷기", "long-run-walk");

  return map;
};

const parseRecordArtifacts = (input: {
  sessions: PAPSSession[];
  teachers: PAPSTeacher[];
  recordRows: string[][];
  errorRows: string[][];
  auditRows: string[][];
  teacherEmail: string;
}): Pick<
  GoogleSheetStructuredState,
  "attempts" | "syncStatuses" | "syncErrorLogs" | "representativeSelectionAuditLogs"
> => {
  const sessionById = new Map(input.sessions.map((session) => [session.id, session]));
  const teacherByEmail = new Map(
    input.teachers.map((teacher) => [teacher.email.trim().toLowerCase(), teacher])
  );
  const eventIdByLabel = buildEventIdByLabel();
  const attempts: PAPSStoredAttempt[] = [];
  const attemptSelectorById = new Map<string, { sessionId: string; studentId: string }>();
  const selectedAttemptByRecordId = new Map<string, { attemptId: string; createdAt: string; teacherEmail: string }>();
  const syncStatusByRecordId = new Map<string, PAPSSyncStatusRecord>();

  for (const row of input.recordRows.filter((entry) => entry[0] && entry[1] && entry[11])) {
    const session = sessionById.get(row[1]!);

    if (!session) {
      continue;
    }

    const measurement = Number(row[14]);

    if (!Number.isFinite(measurement)) {
      continue;
    }

    const createdAt = normalizeIsoValue(row[18] ?? row[4]);
    const attempt: PAPSStoredAttempt = {
      id: row[0]!,
      sessionId: row[1]!,
      studentId: row[11]!,
      eventId: session.eventId,
      unit: (row[10] as PAPSStoredAttempt["unit"]) || PAPS_EVENT_DEFINITIONS[session.eventId].unit,
      attemptNumber: Number(row[13]) || 1,
      measurement,
      createdAt
    };

    attempts.push(attempt);
    attemptSelectorById.set(attempt.id, {
      sessionId: attempt.sessionId,
      studentId: attempt.studentId
    });

    const recordId = `${attempt.sessionId}:${attempt.studentId}`;

    if (row[15] === "Y") {
      selectedAttemptByRecordId.set(recordId, {
        attemptId: attempt.id,
        createdAt,
        teacherEmail: row[16] ?? input.teacherEmail
      });
    }

    const syncStatus = parseSyncStatus(row[19]);

    if (syncStatus) {
      const currentSyncStatus = syncStatusByRecordId.get(recordId);

      if (!currentSyncStatus || currentSyncStatus.updatedAt.localeCompare(createdAt) <= 0) {
        syncStatusByRecordId.set(recordId, {
          id: recordId,
          sessionId: attempt.sessionId,
          studentId: attempt.studentId,
          status: syncStatus,
          attemptId: attempt.id,
          updatedAt: createdAt
        });
      }
    }
  }

  const representativeSelectionAuditLogs = input.auditRows
    .filter((row) => row[0] && row[2] && row[3])
    .map((row) => {
      const session = sessionById.get(row[2]!);
      const teacher =
        teacherByEmail.get((row[1] ?? input.teacherEmail).trim().toLowerCase()) ??
        teacherByEmail.get(input.teacherEmail.trim().toLowerCase()) ??
        null;

      return {
        id: `rep:${row[2]}:${row[3]}:${normalizeIsoValue(row[0])}`,
        sessionId: row[2]!,
        studentId: row[3]!,
        eventId:
          session?.eventId ??
          eventIdByLabel.get(row[4] ?? "") ??
          ("sit-and-reach" as PAPSSession["eventId"]),
        previousAttemptId: row[6] || null,
        selectedAttemptId: row[7] || null,
        changedByTeacherId: teacher?.id ?? createTeacherId(row[1] || input.teacherEmail),
        reason: row[8] || undefined,
        createdAt: normalizeIsoValue(row[0])
      } satisfies PAPSRepresentativeSelectionAuditLog;
    });
  const auditRecordIds = new Set(
    representativeSelectionAuditLogs.map((auditLog) => `${auditLog.sessionId}:${auditLog.studentId}`)
  );

  for (const [recordId, selectedAttempt] of selectedAttemptByRecordId) {
    if (auditRecordIds.has(recordId)) {
      continue;
    }

    const [sessionId, studentId] = recordId.split(":");
    const session = sessionById.get(sessionId ?? "");
    const selectedTeacher =
      teacherByEmail.get(selectedAttempt.teacherEmail.trim().toLowerCase()) ??
      teacherByEmail.get(input.teacherEmail.trim().toLowerCase()) ??
      null;

    if (!session || !studentId) {
      continue;
    }

    representativeSelectionAuditLogs.push({
      id: `rep:${recordId}:${selectedAttempt.createdAt}`,
      sessionId,
      studentId,
      eventId: session.eventId,
      previousAttemptId: null,
      selectedAttemptId: selectedAttempt.attemptId,
      changedByTeacherId:
        selectedTeacher?.id ?? createTeacherId(selectedAttempt.teacherEmail || input.teacherEmail),
      reason: undefined,
      createdAt: selectedAttempt.createdAt
    });
  }

  const syncErrorLogs = input.errorRows
    .filter((row) => row[0] && row[3] && row[4])
    .flatMap((row) => {
      const selector =
        attemptSelectorById.get(row[4]!) ??
        (() => {
          const [sessionId, studentId] = (row[4] ?? "").split(":");

          return sessionId && studentId ? { sessionId, studentId } : null;
        })();

      if (!selector) {
        return [];
      }

      return [
        {
          id: `sync-error:${selector.sessionId}:${selector.studentId}:${normalizeIsoValue(row[0])}`,
          sessionId: selector.sessionId,
          studentId: selector.studentId,
          syncStatusId: `${selector.sessionId}:${selector.studentId}`,
          message: row[3]!,
          createdAt: normalizeIsoValue(row[0])
        } satisfies PAPSSyncErrorLog
      ];
    });

  return {
    attempts,
    syncStatuses: [...syncStatusByRecordId.values()],
    syncErrorLogs,
    representativeSelectionAuditLogs
  };
};

export const buildStructuredStateFromSheet = async ({
  client,
  spreadsheetId,
  teacherEmail
}: BuildTeacherBootstrapFromSheetInput): Promise<GoogleSheetStructuredState> => {
  const [settingsRows, studentRows, recordRows, errorRows, auditRows] = await Promise.all([
    client.readRange(spreadsheetId, SETTINGS_RANGE),
    client.readRange(spreadsheetId, STUDENTS_RANGE),
    client.readRange(spreadsheetId, RECORDS_RANGE),
    client.readRange(spreadsheetId, ERRORS_RANGE),
    client.readRange(spreadsheetId, AUDITS_RANGE)
  ]);
  const rowsByLabel = parseRowMap(settingsRows);
  const teacherId = createTeacherId(teacherEmail);
  const school = buildStructuredSchool(rowsByLabel, spreadsheetId, teacherId);
  const teachers = buildStructuredTeachers(rowsByLabel, school.id, teacherEmail);
  const classes = buildStructuredClasses(rowsByLabel, school.id);
  const sessions = buildStructuredSessions(rowsByLabel);
  const allStudents = parseStudents(studentRows, classes, school.id);
  const recordArtifacts = parseRecordArtifacts({
    sessions,
    teachers,
    recordRows,
    errorRows,
    auditRows,
    teacherEmail
  });

  return {
    school: {
      ...school,
      teacherIds: Array.from(new Set(teachers.map((teacher) => teacher.id))),
      sheetUrl:
        school.sheetUrl ??
        createGoogleSheetsEditLink(
          rowsByLabel.get(SETTINGS_MACHINE_ROW_LABELS.connection)?.[0]?.[1] ??
            parseJsonCell<string | null>(
              rowsByLabel,
              SETTINGS_MACHINE_ROW_LABELS.legacySpreadsheetId,
              null
            ) ??
            spreadsheetId
        )
    },
    classes,
    teachers,
    sessions,
    allStudents,
    attempts: recordArtifacts.attempts,
    syncStatuses: recordArtifacts.syncStatuses,
    syncErrorLogs: recordArtifacts.syncErrorLogs,
    representativeSelectionAuditLogs: recordArtifacts.representativeSelectionAuditLogs
  };
};

export const toTeacherBootstrapFromStructuredState = (
  structuredState: GoogleSheetStructuredState,
  teacherEmail: string
): TeacherBootstrap => {
  const normalizedTeacherEmail = teacherEmail.trim().toLowerCase();
  const teacher =
    structuredState.teachers.find(
      (entry) => entry.email.trim().toLowerCase() === normalizedTeacherEmail
    ) ?? null;

  return {
    teacher,
    school: structuredState.school,
    schools: [structuredState.school],
    classes: structuredState.classes,
    teachers: structuredState.teachers,
    students: structuredState.allStudents.filter((student) => student.active !== false),
    sessions: structuredState.sessions,
    attempts: structuredState.attempts,
    syncStatuses: structuredState.syncStatuses,
    syncErrorLogs: structuredState.syncErrorLogs,
    representativeSelectionAuditLogs: structuredState.representativeSelectionAuditLogs
  };
};

export const buildTeacherBootstrapFromSheet = async (
  input: BuildTeacherBootstrapFromSheetInput
): Promise<TeacherBootstrap> =>
  toTeacherBootstrapFromStructuredState(
    await buildStructuredStateFromSheet(input),
    input.teacherEmail
  );

const buildSettingsRows = (input: {
  spreadsheetId: string;
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  sessions: PAPSSession[];
}): string[][] => {
  const academicYears = new Set<number>();

  for (const classroom of input.classes) {
    academicYears.add(classroom.academicYear);
  }

  for (const session of input.sessions) {
    if (session.academicYear) {
      academicYears.add(session.academicYear);
    }
  }

  const rows: string[][] = [
    ["학교명", input.school.name, "교사가 관리 페이지에서 설정", "", "학생명단", "학교 메타데이터"],
    [
      "학년도",
      [...academicYears].sort((left, right) => left - right).join(", "),
      "모든 탭에서 학년도 컬럼과 함께 사용",
      "",
      "학생명단",
      "학교 메타데이터"
    ],
    [
      "담당교사 이메일",
      input.teachers.map((teacher) => teacher.email).join(", "),
      "구글 로그인 계정",
      "",
      "설정",
      "학교 메타데이터"
    ],
    ["기본 세션 유형", "연습 기록", "세션 생성 시 바꿀 수 있음", "", "설정", "학교 메타데이터"],
    [
      "입력 화면 유형",
      input.sessions.some((session) => session.classScope === "split") ? "1반형 / 2반 분할형" : "1반형",
      "관리 페이지에서 선택",
      "",
      "설정",
      "학교 메타데이터"
    ],
    ["2반 분할 규칙", "같은 종목만 동시 기록", "사용자 승인 반영", "", "설정", "운영 규칙"],
    ["학생 조회 정책", "제출 직후에만 자기 기록 확인", "공용 기기 보호 정책", "", "설정", "운영 규칙"],
    [
      PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL,
      PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
      "프로토타입 예시",
      "",
      "설정",
      "템플릿"
    ],
    ["기록 보관 정책", "최소 해당 학년도 보관", "이전 학년도는 조회용 유지 또는 별도 백업", "", "설정", "운영 규칙"],
    [
      "템플릿 안내 링크",
      input.school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      "복사한 시트의 실제 주소",
      "",
      "설정",
      "연결 정보"
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.school,
      input.school.id,
      input.school.name,
      input.school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      input.school.createdAt,
      input.school.updatedAt
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.connection,
      input.spreadsheetId,
      input.school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      input.school.id,
      "",
      ""
    ],
    ...input.teachers.flatMap((teacher) => [
      [
        SETTINGS_MACHINE_ROW_LABELS.teacher,
        teacher.id,
        teacher.schoolId,
        teacher.name,
        teacher.email,
        ""
      ],
      [
        SETTINGS_MACHINE_ROW_LABELS.teacherMeta,
        teacher.id,
        teacher.createdAt,
        teacher.updatedAt,
        "",
        ""
      ]
    ]),
    ...input.classes.flatMap((classroom) => [
      [
        SETTINGS_MACHINE_ROW_LABELS.class,
        classroom.id,
        classroom.schoolId,
        String(classroom.academicYear),
        String(classroom.gradeLevel),
        String(classroom.classNumber)
      ],
      [
        SETTINGS_MACHINE_ROW_LABELS.classMeta,
        classroom.id,
        classroom.label,
        classroom.active ? "Y" : "N",
        "",
        ""
      ]
    ]),
    ...input.sessions.flatMap((session) => [
      [
        SETTINGS_MACHINE_ROW_LABELS.session,
        session.id,
        session.schoolId ?? "",
        session.teacherId ?? "",
        String(session.academicYear ?? ""),
        session.name ?? session.id
      ],
      [
        SETTINGS_MACHINE_ROW_LABELS.sessionMeta,
        session.id,
        String(session.gradeLevel),
        session.sessionType,
        session.classScope,
        session.eventId
      ],
      [
        SETTINGS_MACHINE_ROW_LABELS.sessionStatus,
        session.id,
        session.isOpen === false ? "N" : "Y",
        session.createdAt ?? toIsoNow(),
        "",
        ""
      ],
      ...session.classTargets.map((target, index) => [
        SETTINGS_MACHINE_ROW_LABELS.sessionTarget,
        session.id,
        target.classId,
        target.eventId,
        String(index),
        ""
      ])
    ])
  ];

  return rows;
};

export const buildSettingsTabValues = (input: {
  spreadsheetId: string;
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  sessions: PAPSSession[];
}): string[][] => [PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[0]!.header, ...buildSettingsRows(input)];

export const buildStudentTabValues = (input: {
  students: PAPSStudent[];
  classes: PAPSClassroom[];
}): string[][] => {
  const classById = new Map(input.classes.map((classroom) => [classroom.id, classroom]));
  const rows = [...input.students]
    .sort((left, right) => {
      const leftClass = classById.get(left.classId);
      const rightClass = classById.get(right.classId);

      return (
        (leftClass?.gradeLevel ?? 0) - (rightClass?.gradeLevel ?? 0) ||
        (leftClass?.classNumber ?? 0) - (rightClass?.classNumber ?? 0) ||
        (left.studentNumber ?? 0) - (right.studentNumber ?? 0) ||
        left.name.localeCompare(right.name)
      );
    })
    .map((student) => {
      const classroom = classById.get(student.classId);

      return [
        student.id,
        String(classroom?.academicYear ?? new Date().getUTCFullYear()),
        String(student.gradeLevel),
        String(classroom?.classNumber ?? ""),
        String(student.studentNumber ?? ""),
        student.name,
        student.sex === "male" ? "남" : "여",
        student.active === false ? "N" : "Y",
        ""
      ];
    });

  return [PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[1]!.header, ...rows];
};
