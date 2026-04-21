import type { PAPSClassroom, PAPSSchool, PAPSSession, PAPSStudent, PAPSTeacher } from "../paps/types";
import { createGoogleSheetsEditLink } from "./drive-link";
import { SETTINGS_MACHINE_ROW_LABELS } from "./sheet-structured-settings";
import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION_ROW_LABEL
} from "./template";

const toIsoNow = (): string => new Date().toISOString();

const buildSessionGroupRows = (sessions: PAPSSession[]): string[][] => {
  const groupedSessions = sessions.filter((session) => session.sessionGroupId);
  const groupById = new Map<string, PAPSSession>();

  for (const session of groupedSessions) {
    if (!session.sessionGroupId || groupById.has(session.sessionGroupId)) {
      continue;
    }

    groupById.set(session.sessionGroupId, session);
  }

  return [
    ...Array.from(groupById.entries()).map(([groupId, session]) => [
      SETTINGS_MACHINE_ROW_LABELS.sessionGroup,
      groupId,
      session.sessionGroupName ?? session.name ?? groupId,
      session.schoolId ?? "",
      session.teacherId ?? "",
      session.createdAt ?? toIsoNow()
    ]),
    ...groupedSessions
      .slice()
      .sort(
        (left, right) =>
          (left.sessionGroupId ?? "").localeCompare(right.sessionGroupId ?? "") ||
          (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
          left.id.localeCompare(right.id)
      )
      .map((session) => [
        SETTINGS_MACHINE_ROW_LABELS.sessionGroupItem,
        session.sessionGroupId ?? "",
        session.id,
        String(session.sessionGroupOrder ?? 0),
        session.eventId,
        ""
      ])
  ];
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
      "교사 화면 접근 PIN",
      input.school.teacherReturnPin ? "설정됨" : "미설정",
      "학생 화면에서 교사 관리 화면으로 돌아갈 때 사용",
      "",
      "설정",
      "보안"
    ],
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
    ...(input.school.teacherReturnPin
      ? [
          [
            SETTINGS_MACHINE_ROW_LABELS.teacherReturnPin,
            JSON.stringify(input.school.teacherReturnPin),
            "교사 화면 접근 PIN 해시",
            "",
            "설정",
            "보안"
          ]
        ]
      : []),
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
    ...buildSessionGroupRows(input.sessions),
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
