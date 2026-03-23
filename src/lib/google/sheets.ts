import { getEventDefinition } from "../paps/catalog";
import { summarizeRepresentativeRecords, summarizeStudentRecord } from "../paps/summaries";
import type {
  PAPSAttemptRecord,
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
import {
  PAPS_GOOGLE_SHEET_PROTOTYPE_TABS,
  PAPS_GOOGLE_SHEET_TEMPLATE_VERSION
} from "./template";

export type GoogleSheetCellValue = string | number | boolean | null;

export interface GoogleSheetTabPayload {
  tabName: string;
  header: string[];
  rows: GoogleSheetCellValue[][];
}

export interface PreparedGoogleSheetTabWrite {
  tabName: string;
  range: string;
  values: string[][];
}

export interface PreparedGoogleSheetWriteRequest {
  spreadsheetId: string;
  valueInputOption: "USER_ENTERED";
  data: PreparedGoogleSheetTabWrite[];
}

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

const validateGoogleSheetTabPayloadShape = (input: unknown): GoogleSheetTabPayload[] => {
  if (!Array.isArray(input)) {
    throw new Error("Google Sheet tabs must be an array.");
  }

  return input.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Each Google Sheet tab must be an object.");
    }

    const candidate = entry as Partial<GoogleSheetTabPayload>;

    if (typeof candidate.tabName !== "string" || candidate.tabName.trim().length === 0) {
      throw new Error("Each Google Sheet tab must include a tabName.");
    }

    if (!Array.isArray(candidate.header)) {
      throw new Error("Each Google Sheet tab must include a header array.");
    }

    if (!Array.isArray(candidate.rows)) {
      throw new Error("Each Google Sheet tab must include a rows array.");
    }

    return {
      tabName: candidate.tabName,
      header: candidate.header.map((value) => {
        if (!isGoogleSheetCellValue(value)) {
          throw new Error("Google Sheet header values must be string, number, boolean, or null.");
        }

        return normalizeCellValue(value);
      }),
      rows: candidate.rows.map((row) => {
        if (!Array.isArray(row)) {
          throw new Error("Each Google Sheet row must be an array.");
        }

        return row.map((value) => {
          if (!isGoogleSheetCellValue(value)) {
            throw new Error("Google Sheet cell values must be string, number, boolean, or null.");
          }

          return value;
        });
      })
    };
  });
};

const escapeTabName = (tabName: string): string => tabName.replace(/'/g, "''");

const normalizeCellValue = (value: GoogleSheetCellValue): string => {
  if (value === null) {
    return "";
  }

  return String(value);
};

const isGoogleSheetCellValue = (value: unknown): value is GoogleSheetCellValue =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

const formatIsoDate = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const formatIsoDateTime = (value?: string | null): string => {
  if (!value) {
    return "";
  }

  return value.slice(0, 19).replace("T", " ");
};

const toSexLabel = (sex: PAPSStudent["sex"]): string => (sex === "male" ? "남" : "여");

const toActiveLabel = (active?: boolean): string => (active === false ? "N" : "Y");

const toSessionTypeLabel = (sessionType: PAPSSession["sessionType"]): string =>
  sessionType === "official" ? "공식" : "연습";

const toScopeLabel = (classScope: PAPSSession["classScope"]): string =>
  classScope === "split" ? "2반 분할형" : "1반형";

const toSyncStatusLabel = (status?: PAPSSyncStatusRecord["status"] | null): string => {
  switch (status) {
    case "failed":
      return "실패";
    case "pending":
      return "대기";
    case "synced":
      return "완료";
    default:
      return "대기";
  }
};

const createAttemptRecords = (
  sessions: PAPSSession[],
  attempts: PAPSStoredAttempt[],
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[]
): PAPSAttemptRecord[] => {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const recordMap = new Map<string, PAPSAttemptRecord>();

  for (const attempt of attempts) {
    const session = sessionById.get(attempt.sessionId);

    if (!session) {
      continue;
    }

    const key = `${attempt.sessionId}:${attempt.studentId}`;
    const currentRecord = recordMap.get(key) ?? {
      sessionId: attempt.sessionId,
      studentId: attempt.studentId,
      eventId: session.eventId,
      unit: attempt.unit,
      attempts: [],
      representativeAttemptId: null
    };

    currentRecord.attempts.push({
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt
    });
    recordMap.set(key, currentRecord);
  }

  for (const record of recordMap.values()) {
    record.attempts.sort((left, right) => left.attemptNumber - right.attemptNumber);
    record.representativeAttemptId =
      representativeSelectionAuditLogs
        .filter(
          (entry) => entry.sessionId === record.sessionId && entry.studentId === record.studentId
        )
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        .at(-1)?.selectedAttemptId ?? null;
  }

  return [...recordMap.values()];
};

const createSettingsRows = ({
  school,
  classes,
  teachers,
  sessions
}: Pick<PapsGoogleSheetSnapshot, "school" | "classes" | "teachers" | "sessions">): GoogleSheetCellValue[][] => {
  const academicYears = new Set<number>();

  for (const classroom of classes) {
    academicYears.add(classroom.academicYear);
  }

  for (const session of sessions) {
    if (session.academicYear) {
      academicYears.add(session.academicYear);
    }
  }

  const settingsRows: [string, GoogleSheetCellValue, string][] = [
    ["학교명", school.name, "교사가 관리 페이지에서 설정"],
    [
      "학년도",
      [...academicYears].sort((left, right) => left - right).join(", ") || "",
      "모든 탭에서 학년도 컬럼과 함께 사용"
    ],
    [
      "담당교사 이메일",
      teachers.map((teacher) => teacher.email).join(", "),
      "구글 로그인 계정"
    ],
    ["기본 세션 유형", "연습 기록", "세션 생성 시 바꿀 수 있음"],
    [
      "입력 화면 유형",
      sessions.some((session) => session.classScope === "split") ? "1반형 / 2반 분할형" : "1반형",
      "관리 페이지에서 선택"
    ],
    ["2반 분할 규칙", "같은 종목만 동시 기록", "사용자 승인 반영"],
    ["학생 조회 정책", "제출 직후에만 자기 기록 확인", "공용 기기 보호 정책"],
    ["시트 템플릿 버전", PAPS_GOOGLE_SHEET_TEMPLATE_VERSION, "프로토타입 예시"],
    ["기록 보관 정책", "최소 해당 학년도 보관", "이전 학년도는 조회용 유지 또는 별도 백업"],
    ["템플릿 안내 링크", school.sheetUrl ?? "https://docs.google.com/spreadsheets/", "실제 구현 시 복사 링크 버튼으로 연결"]
  ];
  const usageRows: [string, string][] = [
    ["학생명단", "학생 기본 정보와 활성 여부"],
    ["세션기록", "학생 입력 원본을 시도별로 모두 누적 저장"],
    ["학생요약", "대표값 기준 최신값, 최고값, 변화량"],
    ["공식평가요약", "공식 평가 세션 대표값과 등급"],
    ["오류로그", "시트 동기화 실패와 주소 오류"],
    ["수정로그", "교사 대표값 선택 및 수정 이력"]
  ];
  const rowCount = Math.max(settingsRows.length, usageRows.length);
  const rows: GoogleSheetCellValue[][] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const settingsRow = settingsRows[index];
    const usageRow = usageRows[index];

    rows.push([
      settingsRow?.[0] ?? "",
      settingsRow?.[1] ?? "",
      settingsRow?.[2] ?? "",
      "",
      usageRow?.[0] ?? "",
      usageRow?.[1] ?? ""
    ]);
  }

  return rows;
};

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
  const classById = new Map(classes.map((classroom) => [classroom.id, classroom]));
  const studentById = new Map(students.map((student) => [student.id, student]));
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));
  const syncStatusByRecordId = new Map(syncStatuses.map((status) => [status.id, status]));
  const latestAuditByRecordId = new Map<string, PAPSRepresentativeSelectionAuditLog>();
  const attemptRecords = createAttemptRecords(sessions, attempts, representativeSelectionAuditLogs);

  for (const auditLog of representativeSelectionAuditLogs) {
    const key = `${auditLog.sessionId}:${auditLog.studentId}`;
    const currentAudit = latestAuditByRecordId.get(key);

    if (!currentAudit || currentAudit.createdAt.localeCompare(auditLog.createdAt) < 0) {
      latestAuditByRecordId.set(key, auditLog);
    }
  }

  const representativeSummaries = summarizeRepresentativeRecords({
    students,
    sessions,
    records: attemptRecords
  });
  const officialSummaryByRecordId = new Map(
    representativeSummaries.officialSummaries.map((summary) => [`${summary.sessionId}:${summary.studentId}`, summary])
  );

  const settingsTab = {
    tabName: "설정",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[0]!.header,
    rows: createSettingsRows({
      school,
      classes,
      teachers,
      sessions
    })
  };
  const studentsTab = {
    tabName: "학생명단",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[1]!.header,
    rows: [...students]
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
          classroom?.academicYear ?? sessions[0]?.academicYear ?? "",
          student.gradeLevel,
          classroom?.classNumber ?? "",
          student.studentNumber ?? "",
          student.name,
          toSexLabel(student.sex),
          toActiveLabel(student.active),
          ""
        ];
      })
  };
  const recordsTab = {
    tabName: "세션기록",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[2]!.header,
    rows: attemptRecords.flatMap((record) => {
      const session = sessionById.get(record.sessionId);
      const student = studentById.get(record.studentId);
      const syncStatus = syncStatusByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const auditLog = latestAuditByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const teacherEmail = auditLog ? (teacherById.get(auditLog.changedByTeacherId)?.email ?? auditLog.changedByTeacherId) : "";
      const officialSummary = officialSummaryByRecordId.get(`${record.sessionId}:${record.studentId}`);
      const targetClassLabels =
        session?.classTargets
          .map((target) => classById.get(target.classId)?.label ?? target.classId)
          .join("+") ?? "";
      const primaryClass = session?.classTargets[0] ? classById.get(session.classTargets[0].classId) : null;
      const recordSummary =
        session && student
          ? summarizeStudentRecord({
              session,
              student,
              record
            })
          : null;

      return record.attempts.map((attempt) => [
        attempt.id,
        record.sessionId,
        session?.name ?? record.sessionId,
        session?.academicYear ?? primaryClass?.academicYear ?? "",
        formatIsoDate(attempt.createdAt),
        session ? toSessionTypeLabel(session.sessionType) : "",
        session ? toScopeLabel(session.classScope) : "",
        targetClassLabels,
        primaryClass?.classNumber ?? "",
        getEventDefinition(record.eventId).label,
        record.unit,
        record.studentId,
        student?.name ?? record.studentId,
        attempt.attemptNumber,
        attempt.measurement,
        attempt.id === record.representativeAttemptId ? "Y" : "N",
        attempt.id === record.representativeAttemptId ? teacherEmail : "",
        attempt.id === record.representativeAttemptId
          ? recordSummary?.officialGrade ?? officialSummary?.officialGrade ?? ""
          : "",
        formatIsoDateTime(attempt.createdAt),
        toSyncStatusLabel(syncStatus?.status),
        auditLog?.reason ?? ""
      ]);
    })
  };
  const studentSummaryTab = {
    tabName: "학생요약",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[3]!.header,
    rows: representativeSummaries.studentSummaries.map((summary) => {
      const classroom = classById.get(summary.classId);

      return [
        summary.studentId,
        summary.studentName,
        summary.gradeLevel,
        classroom?.classNumber ?? "",
        getEventDefinition(summary.eventId).label,
        summary.latestRepresentativeMeasurement,
        summary.unit,
        summary.previousRepresentativeMeasurement ?? "",
        summary.improvement ?? "",
        summary.bestRepresentativeMeasurement,
        formatIsoDate(summary.latestMeasuredAt),
        summary.message
      ];
    })
  };
  const officialSummaryTab = {
    tabName: "공식평가요약",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[4]!.header,
    rows: representativeSummaries.officialSummaries.map((summary) => {
      const classroom = classById.get(summary.classId);
      const auditLog = latestAuditByRecordId.get(`${summary.sessionId}:${summary.studentId}`);

      return [
        summary.studentId,
        summary.studentName,
        summary.gradeLevel,
        classroom?.classNumber ?? "",
        getEventDefinition(summary.eventId).label,
        summary.representativeMeasurement,
        summary.unit,
        summary.officialGrade ?? "",
        formatIsoDate(summary.measuredAt),
        summary.sessionName,
        auditLog?.reason ?? summary.note
      ];
    })
  };
  const errorLogTab = {
    tabName: "오류로그",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[5]!.header,
    rows: syncErrorLogs.map((errorLog) => {
      const syncStatus = syncStatuses.find((entry) => entry.id === errorLog.syncStatusId) ?? null;

      return [
        formatIsoDateTime(errorLog.createdAt),
        "WARN",
        "시트동기화",
        errorLog.message,
        syncStatus?.attemptId ?? errorLog.syncStatusId,
        toSyncStatusLabel(syncStatus?.status),
        syncStatus?.status === "synced" ? formatIsoDateTime(syncStatus.updatedAt) : ""
      ];
    })
  };
  const auditLogTab = {
    tabName: "수정로그",
    header: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[6]!.header,
    rows: representativeSelectionAuditLogs.map((auditLog) => [
      formatIsoDateTime(auditLog.createdAt),
      teacherById.get(auditLog.changedByTeacherId)?.email ?? auditLog.changedByTeacherId,
      auditLog.sessionId,
      auditLog.studentId,
      getEventDefinition(auditLog.eventId).label,
      "대표값선택",
      auditLog.previousAttemptId ?? "",
      auditLog.selectedAttemptId ?? "",
      auditLog.reason ?? ""
    ])
  };

  return [
    settingsTab,
    studentsTab,
    recordsTab,
    studentSummaryTab,
    officialSummaryTab,
    errorLogTab,
    auditLogTab
  ];
};

export const parseGoogleSheetTabPayloads = (input: unknown): GoogleSheetTabPayload[] => {
  return validateGoogleSheetTabPayloadShape(input);
};

export const assertGoogleSheetTabsMatchPrototype = (tabs: GoogleSheetTabPayload[]): GoogleSheetTabPayload[] => {
  if (tabs.length !== PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.length) {
    throw new Error("Manual Google Sheet tabs must match the prototype tab contract.");
  }

  tabs.forEach((tab, index) => {
    const prototypeTab = PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[index];

    if (!prototypeTab) {
      throw new Error("Manual Google Sheet tabs must match the prototype tab contract.");
    }

    if (tab.tabName !== prototypeTab.tabName) {
      throw new Error("Manual Google Sheet tabs must match the prototype tab order and names.");
    }

    if (
      tab.header.length !== prototypeTab.header.length ||
      tab.header.some((value, headerIndex) => value !== prototypeTab.header[headerIndex])
    ) {
      throw new Error(`Manual Google Sheet tab ${tab.tabName} must use the prototype header.`);
    }
  });

  return tabs;
};

export const prepareGoogleSheetTabWrite = (
  payload: GoogleSheetTabPayload
): PreparedGoogleSheetTabWrite => ({
  tabName: payload.tabName,
  range: `'${escapeTabName(payload.tabName)}'!A1`,
  values: [payload.header, ...payload.rows].map((row) => row.map(normalizeCellValue))
});

export const prepareGoogleSheetWriteRequest = (
  spreadsheetId: string,
  tabs: GoogleSheetTabPayload[]
): PreparedGoogleSheetWriteRequest => ({
  spreadsheetId,
  valueInputOption: "USER_ENTERED",
  data: tabs.map(prepareGoogleSheetTabWrite)
});

export const writeGoogleSheetTabs = async (
  spreadsheetId: string,
  tabs: GoogleSheetTabPayload[]
): Promise<{
  ok: true;
  stubbed: true;
  request: PreparedGoogleSheetWriteRequest;
}> => ({
  ok: true,
  stubbed: true,
  request: prepareGoogleSheetWriteRequest(spreadsheetId, tabs)
});
