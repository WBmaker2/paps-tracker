import { createGoogleSheetsEditLink } from "./drive-link";
import type { GoogleSheetsClient } from "./sheets-client";
import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "./template";
import type {
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord,
  PAPSStoredAttempt,
  PAPSStudent
} from "../paps/types";
import type { TeacherBootstrap } from "../store/paps-store-types";

export const SETTINGS_MACHINE_ROW_LABELS = {
  school: "__PAPS_MACHINE_SCHOOL",
  classes: "__PAPS_MACHINE_CLASSES",
  teachers: "__PAPS_MACHINE_TEACHERS",
  sessions: "__PAPS_MACHINE_SESSIONS",
  spreadsheetId: "__PAPS_MACHINE_SPREADSHEET_ID",
  spreadsheetUrl: "__PAPS_MACHINE_SPREADSHEET_URL"
} as const;

export interface GoogleSheetStructuredState {
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  sessions: PAPSSession[];
  allStudents: PAPSStudent[];
}

export interface BuildTeacherBootstrapFromSheetInput {
  client: GoogleSheetsClient;
  spreadsheetId: string;
  teacherEmail: string;
}

const SETTINGS_RANGE = "'설정'!A2:F200";
const STUDENTS_RANGE = "'학생명단'!A2:I1000";

const toIsoNow = (): string => new Date().toISOString();

const createTeacherId = (email: string): string =>
  `teacher-${email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

const parseRowMap = (rows: string[][]): Map<string, string[]> =>
  new Map(rows.filter((row) => row[0]).map((row) => [row[0]!, row]));

const parseJsonCell = <T>(rowsByLabel: Map<string, string[]>, label: string, fallback: T): T => {
  const cellValue = rowsByLabel.get(label)?.[1];

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

const getHumanSettingValue = (rowsByLabel: Map<string, string[]>, label: string): string | null =>
  rowsByLabel.get(label)?.[1] ?? null;

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

export const buildStructuredStateFromSheet = async ({
  client,
  spreadsheetId,
  teacherEmail
}: BuildTeacherBootstrapFromSheetInput): Promise<GoogleSheetStructuredState> => {
  const [settingsRows, studentRows] = await Promise.all([
    client.readRange(spreadsheetId, SETTINGS_RANGE),
    client.readRange(spreadsheetId, STUDENTS_RANGE)
  ]);
  const rowsByLabel = parseRowMap(settingsRows);
  const teacherId = createTeacherId(teacherEmail);
  const machineSchool = parseJsonCell<PAPSSchool | null>(
    rowsByLabel,
    SETTINGS_MACHINE_ROW_LABELS.school,
    null
  );
  const school =
    machineSchool ??
    createDefaultSchool({
      spreadsheetId,
      schoolName: getHumanSettingValue(rowsByLabel, "학교명"),
      sheetUrl:
        parseJsonCell<string | null>(
          rowsByLabel,
          SETTINGS_MACHINE_ROW_LABELS.spreadsheetUrl,
          null
        ) ?? getHumanSettingValue(rowsByLabel, "템플릿 안내 링크"),
      teacherId
    });
  const teachers =
    parseJsonCell<PAPSTeacher[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.teachers, []).length > 0
      ? parseJsonCell<PAPSTeacher[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.teachers, [])
      : [createDefaultTeacher({ email: teacherEmail, schoolId: school.id })];
  const normalizedTeachers = teachers.some(
    (teacher) => teacher.email.trim().toLowerCase() === teacherEmail.trim().toLowerCase()
  )
    ? teachers
    : [...teachers, createDefaultTeacher({ email: teacherEmail, schoolId: school.id })];
  const classes = parseJsonCell<PAPSClassroom[]>(
    rowsByLabel,
    SETTINGS_MACHINE_ROW_LABELS.classes,
    []
  );
  const sessions = parseJsonCell<PAPSSession[]>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.sessions, []);
  const allStudents = parseStudents(studentRows, classes, school.id);

  return {
    school: {
      ...school,
      teacherIds: Array.from(new Set([...(school.teacherIds ?? []), ...normalizedTeachers.map((teacher) => teacher.id)])),
      sheetUrl:
        parseJsonCell<string | null>(rowsByLabel, SETTINGS_MACHINE_ROW_LABELS.spreadsheetUrl, null) ??
        school.sheetUrl ??
        createGoogleSheetsEditLink(spreadsheetId)
    },
    classes,
    teachers: normalizedTeachers,
    sessions,
    allStudents
  };
};

export const buildTeacherBootstrapFromSheet = async (
  input: BuildTeacherBootstrapFromSheetInput
): Promise<TeacherBootstrap> => {
  const structuredState = await buildStructuredStateFromSheet(input);
  const normalizedTeacherEmail = input.teacherEmail.trim().toLowerCase();
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
    attempts: [] satisfies PAPSStoredAttempt[],
    syncStatuses: [] satisfies PAPSSyncStatusRecord[],
    syncErrorLogs: [] satisfies PAPSSyncErrorLog[],
    representativeSelectionAuditLogs: [] satisfies PAPSRepresentativeSelectionAuditLog[]
  };
};

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

  return [
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
    ["템플릿 안내 링크", input.school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId), "복사한 시트의 실제 주소", "", "설정", "연결 정보"],
    [
      SETTINGS_MACHINE_ROW_LABELS.school,
      JSON.stringify(input.school),
      "machine",
      "",
      "",
      ""
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.classes,
      JSON.stringify(input.classes),
      "machine",
      "",
      "",
      ""
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.teachers,
      JSON.stringify(input.teachers),
      "machine",
      "",
      "",
      ""
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.sessions,
      JSON.stringify(input.sessions),
      "machine",
      "",
      "",
      ""
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.spreadsheetId,
      input.spreadsheetId,
      "machine",
      "",
      "",
      ""
    ],
    [
      SETTINGS_MACHINE_ROW_LABELS.spreadsheetUrl,
      input.school.sheetUrl ?? createGoogleSheetsEditLink(input.spreadsheetId),
      "machine",
      "",
      "",
      ""
    ]
  ];
};

export const buildSettingsTabValues = (input: {
  spreadsheetId: string;
  school: PAPSSchool;
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  sessions: PAPSSession[];
}): string[][] => {
  const rows = buildSettingsRows(input);

  return [PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[0]!.header, ...rows];
};

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
