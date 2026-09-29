import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PAPSDemoStoreData, PAPSSession } from "../../src/lib/paps/types";
import { resetRequestStore, getRequestStore } from "../../src/lib/store/paps-memory-store";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  })),
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

const buildSeed = (): PAPSDemoStoreData => ({
  version: 1,
  schools: [
    {
      id: "demo-school",
      name: "Demo Elementary",
      teacherIds: ["demo-teacher"],
      sheetUrl: null,
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
    {
      id: "demo-class-3-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 3,
      classNumber: 1,
      label: "3-1",
      active: true
    },
    {
      id: "demo-class-4-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 4,
      classNumber: 1,
      label: "4-1",
      active: true
    },
    {
      id: "demo-class-5-1",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 1,
      label: "5-1",
      active: true
    }
  ],
  teachers: [
    {
      id: "demo-teacher",
      schoolId: "demo-school",
      name: "Demo Teacher",
      email: "demo-teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [
    {
      id: "student-kim",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe("teacher grouped session flows", () => {
  beforeEach(() => {
    resetRequestStore(buildSeed());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetRequestStore();
  });

  it("creates one grouped session with multiple child event sessions", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const { createStoreForRequest } = await import("../../src/lib/store/paps-store");

    const response = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        name: "3월",
        sessionType: "official",
        classScope: "split",
        primaryClassId: "demo-class-3-1",
        secondaryClassId: "demo-class-4-1",
        primaryEventId: "grip-strength",
        eventIds: ["grip-strength", "standing-long-jump"],
        teacherId: "demo-teacher",
        schoolId: "demo-school",
        isOpen: true
      })
    );
    const payload = (await response.json()) as {
      sessionGroupId?: string | null;
      sessions?: PAPSSession[];
    };

    expect(response.status).toBe(201);
    expect(payload.sessionGroupId).toBeTruthy();
    expect(payload.sessions).toHaveLength(2);
    expect(new Set(payload.sessions?.map((session) => session.sessionGroupId))).toEqual(
      new Set([payload.sessionGroupId])
    );
    expect(payload.sessions?.map((session) => session.name)).toEqual([
      "3월 - 악력",
      "3월 - 제자리멀리뛰기"
    ]);
    expect(payload.sessions?.map((session) => session.eventId)).toEqual([
      "grip-strength",
      "standing-long-jump"
    ]);

    const groupView = await (await createStoreForRequest()).getStudentSessionGroupView(
      payload.sessionGroupId ?? ""
    );

    expect(groupView?.groupName).toBe("3월");
    expect(groupView?.sessions).toHaveLength(2);
    expect(groupView?.sessions[0]?.classSections.map((section) => section.label)).toEqual([
      "3-1",
      "4-1"
    ]);
  });

  it("updates an existing session into a grouped multi-event session and renames it", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const store = getRequestStore();

    store.saveSession({
      id: "existing-session",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "기존 세션",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "grip-strength",
      classTargets: [{ classId: "demo-class-5-1", eventId: "grip-strength" }],
      isOpen: true,
      createdAt: "2026-03-23T09:30:00.000Z"
    });

    const response = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        id: "existing-session",
        name: "3월 통합 세션",
        sessionType: "official",
        classScope: "split",
        primaryClassId: "demo-class-3-1",
        secondaryClassId: "demo-class-4-1",
        primaryEventId: "grip-strength",
        eventIds: ["grip-strength", "standing-long-jump"],
        teacherId: "demo-teacher",
        schoolId: "demo-school"
      })
    );
    const payload = (await response.json()) as {
      sessions?: PAPSSession[];
      sessionGroupId?: string | null;
    };

    expect(response.status).toBe(200);
    expect(payload.sessions).toHaveLength(2);
    expect(payload.sessionGroupId).toBe("existing-session");
    expect(payload.sessions?.map((session) => session.name)).toEqual([
      "3월 통합 세션 - 악력",
      "3월 통합 세션 - 제자리멀리뛰기"
    ]);
    expect(payload.sessions?.map((session) => session.classScope)).toEqual([
      "split",
      "split"
    ]);
  });

  it("allows renaming an existing grouped session even after students have recorded attempts", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const store = getRequestStore();

    store.saveStudent({
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-3-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 3,
      active: true
    });

    store.saveSessions([
      {
        id: "group-session-1",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "기존 3월 - 악력",
        sessionGroupId: "group-1",
        sessionGroupName: "기존 3월",
        sessionGroupOrder: 0,
        gradeLevel: 3,
        sessionType: "official",
        classScope: "split",
        eventId: "grip-strength",
        classTargets: [
          { classId: "demo-class-3-1", eventId: "grip-strength" },
          { classId: "demo-class-4-1", eventId: "grip-strength" }
        ],
        isOpen: true,
        createdAt: "2026-03-23T09:40:00.000Z"
      },
      {
        id: "group-session-2",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "기존 3월 - 제자리멀리뛰기",
        sessionGroupId: "group-1",
        sessionGroupName: "기존 3월",
        sessionGroupOrder: 1,
        gradeLevel: 3,
        sessionType: "official",
        classScope: "split",
        eventId: "standing-long-jump",
        classTargets: [
          { classId: "demo-class-3-1", eventId: "standing-long-jump" },
          { classId: "demo-class-4-1", eventId: "standing-long-jump" }
        ],
        isOpen: true,
        createdAt: "2026-03-23T09:40:00.000Z"
      }
    ]);

    store.appendAttempt({
      id: "attempt-1",
      sessionId: "group-session-1",
      studentId: "student-lee",
      measurement: 25,
      createdAt: "2026-03-23T09:45:00.000Z"
    });

    const response = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        sessionGroupId: "group-1",
        name: "수정된 3월",
        sessionType: "official",
        classScope: "split",
        primaryClassId: "demo-class-3-1",
        secondaryClassId: "demo-class-4-1",
        primaryEventId: "grip-strength",
        eventIds: ["grip-strength", "standing-long-jump"],
        teacherId: "demo-teacher",
        schoolId: "demo-school"
      })
    );
    const payload = (await response.json()) as { sessions?: PAPSSession[] };

    expect(response.status).toBe(200);
    expect(payload.sessions?.map((session) => session.name)).toEqual([
      "수정된 3월 - 악력",
      "수정된 3월 - 제자리멀리뛰기"
    ]);
    expect(payload.sessions?.map((session) => session.sessionGroupName)).toEqual([
      "수정된 3월",
      "수정된 3월"
    ]);
  });

  it("rejects changing the event structure of a session that already has student records", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const store = getRequestStore();

    store.saveSession({
      id: "recorded-session",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "기록 있는 세션",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "grip-strength",
      classTargets: [{ classId: "demo-class-5-1", eventId: "grip-strength" }],
      isOpen: true,
      createdAt: "2026-03-23T09:50:00.000Z"
    });
    store.appendAttempt({
      id: "attempt-2",
      sessionId: "recorded-session",
      studentId: "student-kim",
      measurement: 28,
      createdAt: "2026-03-23T09:55:00.000Z"
    });

    const response = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        id: "recorded-session",
        name: "구조 변경 시도",
        sessionType: "practice",
        classScope: "single",
        primaryClassId: "demo-class-5-1",
        primaryEventId: "standing-long-jump",
        eventIds: ["standing-long-jump"],
        teacherId: "demo-teacher",
        schoolId: "demo-school"
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("이미 학생 기록이 있는 세션은 이름만 수정할 수 있습니다.");
  });

  it("rejects grouped session requests without any selected event", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");

    const response = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        name: "3월",
        sessionType: "official",
        classScope: "split",
        primaryClassId: "demo-class-3-1",
        secondaryClassId: "demo-class-4-1",
        primaryEventId: "grip-strength",
        eventIds: [],
        teacherId: "demo-teacher",
        schoolId: "demo-school",
        isOpen: true
      })
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("At least one event is required.");
  });

  it("shows one unified session list card with consistent session detail text", async () => {
    const { AppShell } = await import("../../src/components/layout/app-shell");
    const { TeacherSessionWorkspace } = await import("../../src/components/teacher/session-form");

    const sessions: PAPSSession[] = [
      {
        id: "session-1",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "3월",
        gradeLevel: 3,
        sessionType: "official",
        classScope: "split",
        eventId: "standing-long-jump",
        classTargets: [
          { classId: "demo-class-3-1", eventId: "standing-long-jump" },
          { classId: "demo-class-4-1", eventId: "standing-long-jump" }
        ],
        isOpen: true,
        createdAt: "2026-03-23T09:20:00.000Z"
      }
    ];

    render(
      <AppShell
        title="교사 대시보드"
        eyebrow="Teacher"
        description="세션 카드 구성을 점검합니다."
      >
        <TeacherSessionWorkspace
          classes={getRequestStore().listClasses()}
          sessions={sessions}
          studentSessionUrls={{ "session-1": "/session/session-1" }}
          defaultTeacherId="demo-teacher"
          defaultSchoolId="demo-school"
        />
      </AppShell>
    );

    expect(screen.getByText("세션 목록")).toBeInTheDocument();
    expect(screen.queryByText("최근 세션")).not.toBeInTheDocument();
    expect(screen.queryByText("세션 상태")).not.toBeInTheDocument();
    expect(screen.getByText("2반 분할 · 공식 · 제자리멀리뛰기")).toBeInTheDocument();
  });
});
