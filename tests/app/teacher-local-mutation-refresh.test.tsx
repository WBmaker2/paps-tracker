import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PAPSClassroom, PAPSSession } from "../../src/lib/paps/types";

const notifyTeacherDataRefresh = vi.fn();

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  buildTeacherMutationHeaders: (headers?: HeadersInit) => new Headers(headers),
  notifyTeacherDataRefresh
}));

const classes: PAPSClassroom[] = [
  {
    id: "class-5-1",
    schoolId: "school-1",
    academicYear: 2026,
    gradeLevel: 5,
    classNumber: 1,
    label: "5-1",
    active: true
  },
  {
    id: "class-5-2",
    schoolId: "school-1",
    academicYear: 2026,
    gradeLevel: 5,
    classNumber: 2,
    label: "5-2",
    active: true
  }
];

const baseSession: PAPSSession = {
  id: "session-1",
  schoolId: "school-1",
  teacherId: "teacher-1",
  academicYear: 2026,
  name: "기존 세션",
  gradeLevel: 5,
  sessionType: "practice",
  classScope: "single",
  eventId: "shuttle-run",
  classTargets: [{ classId: "class-5-1", eventId: "shuttle-run" }],
  isOpen: true,
  createdAt: "2026-04-15T10:00:00.000Z"
};

describe("teacher local mutation refresh behavior", () => {
  afterEach(() => {
    notifyTeacherDataRefresh.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a session locally and only syncs the next version baseline", async () => {
    const { SessionForm } = await import("../../src/components/teacher/session-form");
    const fetchMock = vi.fn(async () =>
      Response.json({
        session: {
          ...baseSession,
          id: "session-2",
          name: "새 세션"
        } satisfies PAPSSession,
        studentSessionUrl: null,
        teacherStateVersion: "version-sessions-2"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onCreated = vi.fn();

    render(
      <SessionForm
        classes={classes}
        defaultTeacherId="teacher-1"
        defaultSchoolId="school-1"
        onCreated={onCreated}
      />
    );

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "새 세션" }
    });
    fireEvent.click(screen.getByLabelText("왕복오래달리기"));
    fireEvent.click(screen.getByRole("button", { name: "세션 저장" }));

    await screen.findByText("세션을 저장했습니다.");

    expect(onCreated).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: "session-2",
          name: "새 세션"
        })
      ],
      null
    );
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-sessions-2"
    });
  });

  it("edits a session name locally and only syncs the next version baseline", async () => {
    const { TeacherSessionWorkspace } = await import("../../src/components/teacher/session-form");
    const fetchMock = vi.fn(async () =>
      Response.json({
        session: {
          ...baseSession,
          name: "수정된 세션"
        } satisfies PAPSSession,
        sessions: [
          {
            ...baseSession,
            name: "수정된 세션"
          } satisfies PAPSSession
        ],
        studentSessionUrl: null,
        teacherStateVersion: "version-sessions-edited"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <TeacherSessionWorkspace
        classes={classes}
        sessions={[baseSession]}
        defaultTeacherId="teacher-1"
        defaultSchoolId="school-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "기존 세션 수정" }));

    expect((screen.getByLabelText("세션 이름") as HTMLInputElement).value).toBe("기존 세션");

    fireEvent.change(screen.getByLabelText("세션 이름"), {
      target: { value: "수정된 세션" }
    });
    fireEvent.click(screen.getByRole("button", { name: "세션 수정" }));

    await screen.findByText("세션을 수정했습니다.");

    expect((await screen.findAllByText("수정된 세션")).length).toBeGreaterThan(0);
    expect(screen.queryByText("기존 세션")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sessions",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"id\":\"session-1\"")
      })
    );
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-sessions-edited"
    });
  });

  it("updates session open state locally and only syncs the next version baseline", async () => {
    const { SessionStatusList } = await import(
      "../../src/components/teacher/session-status-list"
    );
    const fetchMock = vi.fn(async () =>
      Response.json({
        session: {
          ...baseSession,
          isOpen: false
        } satisfies PAPSSession,
        teacherStateVersion: "version-sessions-3"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onUpdated = vi.fn();

    render(<SessionStatusList sessions={[baseSession]} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));

    await screen.findByText("세션 상태를 업데이트했습니다.");

    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "session-1",
        isOpen: false
      })
    );
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-sessions-3"
    });
  });

  it("updates the representative attempt locally and only syncs the next version baseline", async () => {
    const { ResultTable } = await import("../../src/components/teacher/result-table");
    const fetchMock = vi.fn(async () =>
      Response.json({
        record: {
          representativeAttemptId: "attempt-2"
        },
        teacherStateVersion: "version-results-2"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const onRepresentativeChange = vi.fn();

    render(
      <ResultTable
        rows={[
          {
            recordId: "session-1:student-1",
            sessionId: "session-1",
            studentId: "student-1",
            studentName: "김학생",
            classLabel: "5-1",
            sessionName: "셔틀런 세션",
            eventLabel: "왕복오래달리기",
            unit: "laps",
            representativeAttemptId: null,
            attempts: [
              {
                id: "attempt-1",
                attemptNumber: 1,
                measurement: 30,
                createdAt: "2026-04-15T10:00:00.000Z"
              },
              {
                id: "attempt-2",
                attemptNumber: 2,
                measurement: 32,
                createdAt: "2026-04-15T10:01:00.000Z"
              }
            ]
          }
        ]}
        onRepresentativeChange={onRepresentativeChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "2회차 대표값으로 선택" }));

    await screen.findByText("대표값이 업데이트되었습니다.");

    expect(onRepresentativeChange).toHaveBeenCalledWith("session-1:student-1", "attempt-2");
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-results-2"
    });
  });

  it("requeues sync locally and only syncs the next version baseline", async () => {
    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");
    const fetchMock = vi.fn(async () =>
      Response.json({
        syncStatus: {
          status: "pending",
          updatedAt: "2026-04-15T10:05:00.000Z"
        },
        teacherStateVersion: "version-results-3"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SyncStatusCard
        recordId="session-1:student-1"
        status="failed"
        updatedAt="2026-04-15T10:00:00.000Z"
        message="Google Sheets API unavailable"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "재동기화 요청" }));

    await screen.findByText("재동기화를 다시 대기열에 넣었습니다.");

    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-results-3"
    });
  });

  it("rebuilds summaries locally without forcing a full refresh on the current tab", async () => {
    const { SyncStatusCard } = await import("../../src/components/teacher/sync-status-card");
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        updatedTabs: ["학생요약", "공식평가요약"]
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <SyncStatusCard
        recordId="session-1:student-1"
        status="failed"
        updatedAt="2026-04-15T10:00:00.000Z"
        message="Google Sheets API unavailable"
        rebuildSessionId="session-1"
        duplicateAttemptCount={1}
        initialRebuildNeeded
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "요약 재계산" }));

    await screen.findByText("학생요약과 공식평가요약을 다시 정리했습니다.");

    expect(notifyTeacherDataRefresh).not.toHaveBeenCalled();
  });
});
