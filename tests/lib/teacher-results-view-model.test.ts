import { describe, expect, it } from "vitest";

import type {
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSSession,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord,
  PAPSStudent
} from "../../src/lib/paps/types";

describe("teacher results view model", () => {
  it("builds filter-ready rows across multiple sessions and computes options with initial focus", async () => {
    const { buildTeacherResultsViewModel } = await import("../../src/lib/teacher-results");

    const classes: PAPSClassroom[] = [
      {
        id: "class-5-1",
        schoolId: "school-1",
        academicYear: 2026,
        gradeLevel: 5,
        classNumber: 1,
        label: "5학년 1반",
        active: true
      },
      {
        id: "class-4-2",
        schoolId: "school-1",
        academicYear: 2026,
        gradeLevel: 4,
        classNumber: 2,
        label: "4학년 2반",
        active: true
      }
    ];

    const students: PAPSStudent[] = [
      {
        id: "student-kim",
        schoolId: "school-1",
        classId: "class-5-1",
        gradeLevel: 5,
        studentNumber: 1,
        name: "홍길동",
        sex: "male",
        active: true
      },
      {
        id: "student-lee",
        schoolId: "school-1",
        classId: "class-4-2",
        gradeLevel: 4,
        studentNumber: 2,
        name: "이하나",
        sex: "female",
        active: true
      }
    ];

    const sessions: PAPSSession[] = [
      {
        id: "session-practice-1",
        schoolId: "school-1",
        teacherId: "teacher-1",
        academicYear: 2026,
        name: "4학년 2반 3월 연습",
        gradeLevel: 4,
        sessionType: "practice",
        classScope: "single",
        eventId: "shuttle-run",
        classTargets: [{ classId: "class-4-2", eventId: "shuttle-run" }],
        isOpen: false,
        createdAt: "2026-03-29T09:00:00.000Z"
      },
      {
        id: "session-official-1",
        schoolId: "school-1",
        teacherId: "teacher-1",
        academicYear: 2026,
        name: "5학년 1반 3월 공식",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "class-5-1", eventId: "sit-and-reach" }],
        isOpen: true,
        createdAt: "2026-03-30T09:00:00.000Z"
      }
    ];

    const recordsBySession: Record<string, PAPSAttemptRecord[]> = {
      "session-official-1": [
        {
          sessionId: "session-official-1",
          studentId: "student-kim",
          eventId: "sit-and-reach",
          unit: "cm",
          representativeAttemptId: "attempt-2",
          attempts: [
            {
              id: "attempt-1",
              attemptNumber: 1,
              measurement: 18,
              createdAt: "2026-03-30T09:20:00.000Z",
              clientSubmissionKey: "submit-kim-1"
            },
            {
              id: "attempt-2",
              attemptNumber: 2,
              measurement: 22,
              createdAt: "2026-03-30T09:21:00.000Z",
              clientSubmissionKey: "submit-kim-1"
            }
          ]
        }
      ],
      "session-practice-1": [
        {
          sessionId: "session-practice-1",
          studentId: "student-lee",
          eventId: "shuttle-run",
          unit: "laps",
          representativeAttemptId: null,
          attempts: [
            {
              id: "attempt-3",
              attemptNumber: 1,
              measurement: 32,
              createdAt: "2026-03-29T09:40:00.000Z",
              clientSubmissionKey: "submit-lee-1"
            }
          ]
        }
      ]
    };

    const syncStatuses: PAPSSyncStatusRecord[] = [
      {
        id: "session-official-1:student-kim",
        sessionId: "session-official-1",
        studentId: "student-kim",
        status: "synced",
        attemptId: "attempt-2",
        updatedAt: "2026-03-30T09:21:10.000Z"
      }
    ];

    const syncErrorLogs: PAPSSyncErrorLog[] = [
      {
        id: "error-1",
        sessionId: "session-practice-1",
        studentId: "student-lee",
        syncStatusId: "session-practice-1:student-lee",
        message: "temporary error",
        createdAt: "2026-03-29T09:41:00.000Z"
      }
    ];

    const viewModel = buildTeacherResultsViewModel({
      classes,
      students,
      sessions,
      recordsBySession,
      syncStatuses,
      syncErrorLogs
    });

    expect(viewModel.rows).toHaveLength(2);
    expect(viewModel.initialFocusRecordId).toBe("session-official-1:student-kim");

    expect(viewModel.rows[0]).toMatchObject({
      recordId: "session-official-1:student-kim",
      studentName: "홍길동",
      studentNameNormalized: "홍길동",
      classId: "class-5-1",
      classNumber: 1,
      gradeLevel: 5,
      sessionType: "official",
      eventId: "sit-and-reach",
      eventLabel: "앉아윗몸앞으로굽히기",
      duplicateAttemptCount: 1
    });

    expect(viewModel.filterOptions.grades).toEqual([
      { value: 4, label: "4학년" },
      { value: 5, label: "5학년" }
    ]);
    expect(viewModel.filterOptions.classes).toEqual([
      { value: "class-4-2", label: "4학년 2반", gradeLevel: 4 },
      { value: "class-5-1", label: "5학년 1반", gradeLevel: 5 }
    ]);
    expect(viewModel.filterOptions.events).toEqual([
      { value: "shuttle-run", label: "왕복오래달리기" },
      { value: "sit-and-reach", label: "앉아윗몸앞으로굽히기" }
    ]);
    expect(viewModel.filterOptions.sessionTypes).toEqual([
      { value: "all", label: "전체" },
      { value: "official", label: "공식" },
      { value: "practice", label: "연습" }
    ]);

    expect(viewModel.syncStateByRecordId["session-official-1:student-kim"]).toEqual({
      status: "synced",
      updatedAt: "2026-03-30T09:21:10.000Z",
      message: null
    });
    expect(viewModel.syncStateByRecordId["session-practice-1:student-lee"]).toEqual({
      status: "pending",
      updatedAt: "-",
      message: "temporary error"
    });
  });
});
