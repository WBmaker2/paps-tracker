import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPapsGoogleSheetTabPayloads } from "../../src/lib/google/sheets";
import { PAPS_GOOGLE_SHEET_PROTOTYPE_TABS } from "../../src/lib/google/template";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "teacher@example.com",
      name: "Teacher",
      image: null
    }
  }))
}));

vi.mock("../../src/lib/demo-store", () => ({
  getDemoStore: vi.fn(() => ({
    listSchools: () => seed.schools,
    getSchool: (schoolId: string) => {
      const school = seed.schools.find((entry) => entry.id === schoolId);

      if (!school) {
        throw new Error(`School ${schoolId} was not found.`);
      }

      return school;
    },
    listClasses: () => seed.classes,
    listTeachers: () => seed.teachers,
    getTeacherByEmail: (email: string) =>
      seed.teachers.find((entry) => entry.email === email) ?? null,
    listStudents: () => seed.students,
    listSessions: () => seed.sessions,
    listSessionRecords: (sessionId: string) => {
      const session = seed.sessions.find((entry) => entry.id === sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} was not found.`);
      }

      return [...new Set(seed.attempts.filter((entry) => entry.sessionId === sessionId).map((entry) => entry.studentId))].map(
        (studentId) => ({
          sessionId,
          studentId,
          eventId: session.eventId,
          unit:
            seed.attempts.find(
              (entry) => entry.sessionId === sessionId && entry.studentId === studentId
            )?.unit ?? "cm",
          attempts: seed.attempts
            .filter((entry) => entry.sessionId === sessionId && entry.studentId === studentId)
            .sort((left, right) => left.attemptNumber - right.attemptNumber)
            .map((attempt) => ({
              id: attempt.id,
              attemptNumber: attempt.attemptNumber,
              measurement: attempt.measurement,
              createdAt: attempt.createdAt
            })),
          representativeAttemptId:
            seed.representativeSelectionAuditLogs
              .filter((entry) => entry.sessionId === sessionId && entry.studentId === studentId)
              .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
              .at(-1)?.selectedAttemptId ?? null
        })
      );
    },
    listSyncStatuses: () => seed.syncStatuses,
    listSyncErrorLogs: () => seed.syncErrorLogs,
    listRepresentativeSelectionAuditLogs: () => seed.representativeSelectionAuditLogs,
    getAttemptRecord: ({ sessionId, studentId }: { sessionId: string; studentId: string }) => {
      const session = seed.sessions.find((entry) => entry.id === sessionId);

      if (!session) {
        throw new Error(`Session ${sessionId} was not found.`);
      }

      const attempts = seed.attempts
        .filter((entry) => entry.sessionId === sessionId && entry.studentId === studentId)
        .sort((left, right) => left.attemptNumber - right.attemptNumber)
        .map((attempt) => ({
          id: attempt.id,
          attemptNumber: attempt.attemptNumber,
          measurement: attempt.measurement,
          createdAt: attempt.createdAt
        }));
      const representativeAttemptId =
        seed.representativeSelectionAuditLogs
          .filter((entry) => entry.sessionId === sessionId && entry.studentId === studentId)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
          .at(-1)?.selectedAttemptId ?? null;

      return {
        sessionId,
        studentId,
        eventId: session.eventId,
        unit: seed.attempts.find((entry) => entry.sessionId === sessionId)?.unit ?? "cm",
        attempts,
        representativeAttemptId
      };
    }
  }))
}));

const seed: PAPSDemoStoreData = {
  version: 1,
  schools: [
    {
      id: "school-1",
      name: "Alpha Elementary",
      teacherIds: ["teacher-1"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "class-5-1",
      schoolId: "school-1",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    }
  ],
  teachers: [
    {
      id: "teacher-1",
      schoolId: "school-1",
      name: "Teacher",
      email: "teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [
    {
      id: "student-1",
      schoolId: "school-1",
      classId: "class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-2",
      schoolId: "school-1",
      classId: "class-5-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "practice-1",
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "5-1 Shuttle Run Practice A",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
      isOpen: false,
      createdAt: "2026-03-23T09:00:00.000Z"
    },
    {
      id: "practice-2",
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "5-1 Shuttle Run Practice B",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
      isOpen: false,
      createdAt: "2026-03-23T10:00:00.000Z"
    },
    {
      id: "official-1",
      schoolId: "school-1",
      teacherId: "teacher-1",
      academicYear: 2026,
      name: "5-1 Sit And Reach Official",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "class-5-1", eventId: "sit-and-reach" }],
      isOpen: false,
      createdAt: "2026-03-23T11:00:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-1",
      sessionId: "practice-1",
      studentId: "student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 1,
      measurement: 31,
      createdAt: "2026-03-23T09:01:00.000Z"
    },
    {
      id: "attempt-2",
      sessionId: "practice-1",
      studentId: "student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 2,
      measurement: 33,
      createdAt: "2026-03-23T09:02:00.000Z"
    },
    {
      id: "attempt-3",
      sessionId: "practice-2",
      studentId: "student-1",
      eventId: "shuttle-run",
      unit: "laps",
      attemptNumber: 1,
      measurement: 35,
      createdAt: "2026-03-23T10:02:00.000Z"
    },
    {
      id: "attempt-4",
      sessionId: "official-1",
      studentId: "student-2",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T11:01:00.000Z"
    },
    {
      id: "attempt-5",
      sessionId: "official-1",
      studentId: "student-2",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 21,
      createdAt: "2026-03-23T11:02:00.000Z"
    }
  ],
  syncStatuses: [
    {
      id: "practice-2:student-1",
      sessionId: "practice-2",
      studentId: "student-1",
      status: "failed",
      attemptId: "attempt-3",
      updatedAt: "2026-03-23T10:05:00.000Z"
    },
    {
      id: "official-1:student-2",
      sessionId: "official-1",
      studentId: "student-2",
      status: "synced",
      attemptId: "attempt-5",
      updatedAt: "2026-03-23T11:05:00.000Z"
    }
  ],
  syncErrorLogs: [
    {
      id: "sync-error:practice-2:student-1:2026-03-23T10:05:00.000Z",
      sessionId: "practice-2",
      studentId: "student-1",
      syncStatusId: "practice-2:student-1",
      message: "Sheets write failed",
      createdAt: "2026-03-23T10:05:00.000Z"
    }
  ],
  representativeSelectionAuditLogs: [
    {
      id: "rep:practice-1:student-1:2026-03-23T09:03:00.000Z",
      sessionId: "practice-1",
      studentId: "student-1",
      eventId: "shuttle-run",
      previousAttemptId: null,
      selectedAttemptId: "attempt-2",
      changedByTeacherId: "teacher-1",
      reason: "Best lap count",
      createdAt: "2026-03-23T09:03:00.000Z"
    },
    {
      id: "rep:practice-2:student-1:2026-03-23T10:03:00.000Z",
      sessionId: "practice-2",
      studentId: "student-1",
      eventId: "shuttle-run",
      previousAttemptId: null,
      selectedAttemptId: "attempt-3",
      changedByTeacherId: "teacher-1",
      reason: "Latest practice record",
      createdAt: "2026-03-23T10:03:00.000Z"
    },
    {
      id: "rep:official-1:student-2:2026-03-23T11:03:00.000Z",
      sessionId: "official-1",
      studentId: "student-2",
      eventId: "sit-and-reach",
      previousAttemptId: "attempt-4",
      selectedAttemptId: "attempt-5",
      changedByTeacherId: "teacher-1",
      reason: "Second attempt selected",
      createdAt: "2026-03-23T11:03:00.000Z"
    }
  ]
};

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe("Google Sheet payload serialization", () => {
  it("covers every prototype tab with the exact prototype headers", () => {
    const tabs = createPapsGoogleSheetTabPayloads({
      school: seed.schools[0]!,
      classes: seed.classes,
      teachers: seed.teachers,
      students: seed.students,
      sessions: seed.sessions,
      attempts: seed.attempts,
      syncStatuses: seed.syncStatuses,
      syncErrorLogs: seed.syncErrorLogs,
      representativeSelectionAuditLogs: seed.representativeSelectionAuditLogs
    });

    expect(tabs.map((tab) => tab.tabName)).toEqual(
      PAPS_GOOGLE_SHEET_PROTOTYPE_TABS.map((tab) => tab.tabName)
    );

    for (const prototypeTab of PAPS_GOOGLE_SHEET_PROTOTYPE_TABS) {
      expect(tabs.find((tab) => tab.tabName === prototypeTab.tabName)?.header).toEqual(
        prototypeTab.header
      );
    }

    expect(tabs.find((tab) => tab.tabName === "설정")?.header).toEqual([
      "항목",
      "값",
      "설명",
      "",
      "사용 탭",
      "역할"
    ]);
    expect(tabs.find((tab) => tab.tabName === "설정")?.rows[0]).toEqual([
      "학교명",
      "Alpha Elementary",
      "교사가 관리 페이지에서 설정",
      "",
      "학생명단",
      "학생 기본 정보와 활성 여부"
    ]);
    expect(tabs.find((tab) => tab.tabName === "설정")?.rows[6]).toEqual([
      "학생 조회 정책",
      "제출 직후에만 자기 기록 확인",
      "공용 기기 보호 정책",
      "",
      "",
      ""
    ]);

    expect(tabs.find((tab) => tab.tabName === "학생명단")?.rows[0]).toEqual([
      "student-1",
      2026,
      5,
      1,
      1,
      "Kim",
      "여",
      "Y",
      ""
    ]);

    expect(tabs.find((tab) => tab.tabName === "세션기록")?.rows).toContainEqual([
      "attempt-5",
      "official-1",
      "5-1 Sit And Reach Official",
      2026,
      "2026-03-23",
      "공식",
      "1반형",
      "5-1",
      1,
      "Sit and Reach",
      "cm",
      "student-2",
      "Lee",
      2,
      21,
      "Y",
      "teacher@example.com",
      3,
      "2026-03-23 11:02:00",
      "완료",
      "Second attempt selected"
    ]);
    expect(tabs.find((tab) => tab.tabName === "세션기록")?.rows).toContainEqual([
      "attempt-4",
      "official-1",
      "5-1 Sit And Reach Official",
      2026,
      "2026-03-23",
      "공식",
      "1반형",
      "5-1",
      1,
      "Sit and Reach",
      "cm",
      "student-2",
      "Lee",
      1,
      18,
      "N",
      "",
      "",
      "2026-03-23 11:01:00",
      "완료",
      "Second attempt selected"
    ]);

    expect(tabs.find((tab) => tab.tabName === "학생요약")?.rows).toContainEqual([
      "student-1",
      "Kim",
      5,
      1,
      "Shuttle Run",
      35,
      "laps",
      33,
      2,
      35,
      "2026-03-23",
      "지난 기록 대비 +2laps"
    ]);

    expect(tabs.find((tab) => tab.tabName === "공식평가요약")?.rows).toEqual([
      [
        "student-2",
        "Lee",
        5,
        1,
        "Sit and Reach",
        21,
        "cm",
        3,
        "2026-03-23",
        "5-1 Sit And Reach Official",
        "Second attempt selected"
      ]
    ]);

    expect(tabs.find((tab) => tab.tabName === "오류로그")?.rows).toEqual([
      [
        "2026-03-23 10:05:00",
        "WARN",
        "시트동기화",
        "Sheets write failed",
        "attempt-3",
        "실패",
        ""
      ]
    ]);

    expect(tabs.find((tab) => tab.tabName === "수정로그")?.rows).toContainEqual([
      "2026-03-23 11:03:00",
      "teacher@example.com",
      "official-1",
      "student-2",
      "Sit and Reach",
      "대표값선택",
      "attempt-4",
      "attempt-5",
      "Second attempt selected"
    ]);
  });
});

describe("Google Sheet routes", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns prototype tab metadata when validating a sheet URL", async () => {
    const route = await import("../../app/api/google-sheet/validate/route");
    const response = await route.POST(
      jsonRequest("/api/google-sheet/validate", "POST", {
        url: "https://docs.google.com/spreadsheets/d/sheet-123/edit"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      spreadsheetId: "sheet-123",
      prototypeTabs: PAPS_GOOGLE_SHEET_PROTOTYPE_TABS
    });
  });

  it("builds app-derived payloads for file-store resync requests", async () => {
    const route = await import("../../app/api/google-sheet/resync/route");
    const response = await route.POST(
      jsonRequest("/api/google-sheet/resync", "POST", {
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        source: "file-store"
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      stubbed: true,
      plan: {
        spreadsheetId: "sheet-123",
        source: "file-store",
        request: {
          data: expect.arrayContaining([
            expect.objectContaining({
              tabName: "설정",
              values: expect.arrayContaining([
                PAPS_GOOGLE_SHEET_PROTOTYPE_TABS[0]!.header
              ])
            }),
            expect.objectContaining({
              tabName: "학생요약"
            })
          ])
        }
      }
    });
  });

  it("rejects manual tabs that do not match the prototype contract", async () => {
    const route = await import("../../app/api/google-sheet/resync/route");
    const response = await route.POST(
      jsonRequest("/api/google-sheet/resync", "POST", {
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        tabs: [
          {
            tabName: "설정",
            header: ["항목", "값", "설명"],
            rows: []
          }
        ]
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: expect.stringContaining("prototype")
    });
  });
});
