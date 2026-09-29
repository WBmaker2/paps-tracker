import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PAPSDemoStoreData } from "../../src/lib/paps/types";
import { getRequestStore, resetRequestStore } from "../../src/lib/store/paps-memory-store";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

export const buildStudentSeed = (): PAPSDemoStoreData => ({
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
    },
    {
      id: "demo-class-5-2",
      schoolId: "demo-school",
      academicYear: 2026,
      gradeLevel: 5,
      classNumber: 2,
      label: "5-2",
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
      id: "student-choi",
      schoolId: "demo-school",
      classId: "demo-class-4-1",
      studentNumber: 1,
      name: "Choi",
      sex: "male",
      gradeLevel: 4,
      active: true
    },
    {
      id: "student-kim",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-park",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 2,
      name: "Park",
      sex: "male",
      gradeLevel: 5,
      active: true
    },
    {
      id: "student-lee",
      schoolId: "demo-school",
      classId: "demo-class-5-2",
      studentNumber: 1,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "session-grade4-jump",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "4-1 Standing Long Jump",
      gradeLevel: 4,
      sessionType: "official",
      classScope: "single",
      eventId: "standing-long-jump",
      classTargets: [{ classId: "demo-class-4-1", eventId: "standing-long-jump" }],
      isOpen: true,
      createdAt: "2026-03-23T09:05:00.000Z"
    },
    {
      id: "session-open-single",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Official Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:10:00.000Z"
    },
    {
      id: "session-previous-sit",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "3월 앉아윗몸앞으로굽히기",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: false,
      createdAt: "2026-03-01T09:10:00.000Z"
    },
    {
      id: "session-grip",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Grip Strength",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "grip-strength",
      classTargets: [{ classId: "demo-class-5-1", eventId: "grip-strength" }],
      isOpen: true,
      createdAt: "2026-03-23T09:17:00.000Z"
    },
    {
      id: "session-step-test",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5-1 Step Test",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "step-test",
      classTargets: [{ classId: "demo-class-5-1", eventId: "step-test" }],
      isOpen: true,
      createdAt: "2026-03-23T09:15:00.000Z"
    },
    {
      id: "session-flexibility",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "4-1 Comprehensive Flexibility",
      gradeLevel: 4,
      sessionType: "official",
      classScope: "single",
      eventId: "comprehensive-flexibility",
      classTargets: [
        { classId: "demo-class-4-1", eventId: "comprehensive-flexibility" }
      ],
      isOpen: true,
      createdAt: "2026-03-23T09:16:00.000Z"
    },
    {
      id: "session-open-split",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "5th Grade Shuttle Run",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "split",
      eventId: "shuttle-run",
      classTargets: [
        { classId: "demo-class-5-1", eventId: "shuttle-run" },
        { classId: "demo-class-5-2", eventId: "shuttle-run" }
      ],
      isOpen: true,
      createdAt: "2026-03-23T09:20:00.000Z"
    },
    {
      id: "session-closed",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "Closed Sit And Reach",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: false,
      createdAt: "2026-03-23T09:30:00.000Z"
    }
  ],
  attempts: [
    {
      id: "attempt-previous-sit",
      sessionId: "session-previous-sit",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 16,
      createdAt: "2026-03-01T09:40:00.000Z"
    },
    {
      id: "attempt-1",
      sessionId: "session-open-single",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 18,
      createdAt: "2026-03-23T09:40:00.000Z"
    },
    {
      id: "attempt-2",
      sessionId: "session-open-single",
      studentId: "student-kim",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 2,
      measurement: 21,
      createdAt: "2026-03-23T09:42:00.000Z"
    }
  ],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

export const jsonRequest = (pathname: string, method: string, body?: unknown): NextRequest =>
  new NextRequest(`http://localhost${pathname}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

export const renderStudentSessionPage = async (sessionId: string) => {
  const pageModule = await import("../../app/session/[sessionId]/page");

  render(
    await pageModule.default({
      params: Promise.resolve({
        sessionId
      }),
      searchParams: Promise.resolve({})
    })
  );
};

export const installStudentApiFetch = async () => {
  const submitRoute = await import("../../app/api/sessions/[sessionId]/submit/route");

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const pathname = new URL(url, "http://localhost").pathname;
      const method = (init?.method ?? "GET").toUpperCase();
      const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : undefined;

      if (pathname.startsWith("/api/sessions/") && pathname.endsWith("/submit") && method === "POST") {
        const sessionId = pathname.split("/")[3] ?? "";

        return submitRoute.POST(jsonRequest(pathname, method, body), {
          params: Promise.resolve({ sessionId })
        });
      }

      if (pathname.startsWith("/api/sessions/") && pathname.endsWith("/submit") && method === "PATCH") {
        const sessionId = pathname.split("/")[3] ?? "";

        return submitRoute.PATCH(jsonRequest(pathname, method, body), {
          params: Promise.resolve({ sessionId })
        });
      }

      throw new Error(`Unhandled fetch request: ${method} ${pathname}`);
    })
  );
};
