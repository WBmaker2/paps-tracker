import { describe, expect, it } from "vitest";

import { buildDerivedGoogleSheetTabPayloads } from "../../src/lib/google/sheet-derived-tab-payloads";

describe("Google Sheet derived tab payloads", () => {
  it("builds record, summary, error, and audit tabs from snapshot data", () => {
    const tabs = buildDerivedGoogleSheetTabPayloads({
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
        }
      ],
      sessions: [
        {
          id: "session-1",
          schoolId: "school-1",
          teacherId: "teacher-1",
          academicYear: 2026,
          name: "Shuttle Run Practice",
          gradeLevel: 5,
          sessionType: "practice",
          classScope: "single",
          eventId: "shuttle-run",
          classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
          isOpen: false,
          createdAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      attempts: [
        {
          id: "attempt-1",
          sessionId: "session-1",
          studentId: "student-1",
          eventId: "shuttle-run",
          unit: "laps",
          attemptNumber: 1,
          measurement: 31,
          createdAt: "2026-03-23T09:01:00.000Z"
        },
        {
          id: "attempt-2",
          sessionId: "session-1",
          studentId: "student-1",
          eventId: "shuttle-run",
          unit: "laps",
          attemptNumber: 2,
          measurement: 33,
          createdAt: "2026-03-23T09:02:00.000Z"
        }
      ],
      syncStatuses: [
        {
          id: "session-1:student-1",
          sessionId: "session-1",
          studentId: "student-1",
          status: "failed",
          attemptId: "attempt-2",
          updatedAt: "2026-03-23T09:05:00.000Z"
        }
      ],
      syncErrorLogs: [
        {
          id: "sync-error:session-1:student-1:2026-03-23T09:05:00.000Z",
          sessionId: "session-1",
          studentId: "student-1",
          syncStatusId: "session-1:student-1",
          message: "Sheets write failed",
          createdAt: "2026-03-23T09:05:00.000Z"
        }
      ],
      representativeSelectionAuditLogs: [
        {
          id: "rep:session-1:student-1:2026-03-23T09:03:00.000Z",
          sessionId: "session-1",
          studentId: "student-1",
          eventId: "shuttle-run",
          previousAttemptId: "attempt-1",
          selectedAttemptId: "attempt-2",
          changedByTeacherId: "teacher-1",
          reason: "Best lap count",
          createdAt: "2026-03-23T09:03:00.000Z"
        }
      ]
    });

    expect(tabs.map((tab) => tab.tabName)).toEqual([
      "세션기록",
      "학생요약",
      "공식평가요약",
      "오류로그",
      "수정로그"
    ]);
    expect(tabs[0]?.rows[1]?.slice(0, 6)).toEqual([
      "attempt-2",
      "session-1",
      "Shuttle Run Practice",
      2026,
      "2026-03-23",
      "연습"
    ]);
    expect(tabs[1]?.rows[0]?.[1]).toBe("Kim");
    expect(tabs[3]?.rows[0]?.slice(0, 4)).toEqual([
      "2026-03-23 09:05:00",
      "WARN",
      "시트동기화",
      "Sheets write failed"
    ]);
    expect(tabs[4]?.rows[0]?.slice(1, 6)).toEqual([
      "teacher@example.com",
      "session-1",
      "student-1",
      "왕복오래달리기",
      "대표값선택"
    ]);
  });
});
