import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDemoStore } from "../../src/lib/demo-store";
import type { PAPSDemoStoreData } from "../../src/lib/paps/types";

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession: vi.fn(async () => ({
    ok: true as const,
    session: {
      email: "demo-teacher@example.com",
      name: "Demo Teacher",
      image: null
    }
  }))
}));

const createTempStorePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "paps-teacher-auth-")), "demo-store.json");

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
    },
    {
      id: "other-school",
      name: "Other Elementary",
      teacherIds: ["other-teacher"],
      sheetUrl: null,
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  classes: [
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
      id: "other-class-5-1",
      schoolId: "other-school",
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
    },
    {
      id: "other-teacher",
      schoolId: "other-school",
      name: "Other Teacher",
      email: "other-teacher@example.com",
      createdAt: "2026-03-23T09:00:00.000Z",
      updatedAt: "2026-03-23T09:00:00.000Z"
    }
  ],
  students: [
    {
      id: "demo-student",
      schoolId: "demo-school",
      classId: "demo-class-5-1",
      studentNumber: 1,
      name: "Kim",
      sex: "female",
      gradeLevel: 5,
      active: true
    },
    {
      id: "other-student",
      schoolId: "other-school",
      classId: "other-class-5-1",
      studentNumber: 2,
      name: "Lee",
      sex: "male",
      gradeLevel: 5,
      active: true
    }
  ],
  sessions: [
    {
      id: "demo-session",
      schoolId: "demo-school",
      teacherId: "demo-teacher",
      academicYear: 2026,
      name: "Demo Session",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:10:00.000Z"
    },
    {
      id: "other-session",
      schoolId: "other-school",
      teacherId: "other-teacher",
      academicYear: 2026,
      name: "Other Session",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "other-class-5-1", eventId: "sit-and-reach" }],
      isOpen: true,
      createdAt: "2026-03-23T09:20:00.000Z"
    }
  ],
  attempts: [
    {
      id: "other-attempt-1",
      sessionId: "other-session",
      studentId: "other-student",
      eventId: "sit-and-reach",
      unit: "cm",
      attemptNumber: 1,
      measurement: 19,
      createdAt: "2026-03-23T09:21:00.000Z"
    }
  ],
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

describe("teacher route authorization scoping", () => {
  let storePath = "";

  beforeEach(() => {
    vi.resetModules();
    storePath = createTempStorePath();
    process.env.PAPS_STORE_PATH = storePath;
    createDemoStore({
      filePath: storePath,
      seedData: buildSeed()
    });
  });

  afterEach(() => {
    delete process.env.PAPS_STORE_PATH;
  });

  it("denies cross-school session and record access", async () => {
    const sessionsRoute = await import("../../app/api/sessions/route");
    const sessionRoute = await import("../../app/api/sessions/[sessionId]/route");
    const representativeRoute = await import(
      "../../app/api/records/[recordId]/representative/route"
    );

    const createResponse = await sessionsRoute.POST(
      jsonRequest("/api/sessions", "POST", {
        name: "Unauthorized Session",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        primaryClassId: "other-class-5-1",
        primaryEventId: "sit-and-reach"
      })
    );
    const getResponse = await sessionRoute.GET(jsonRequest("/api/sessions/other-session", "GET"), {
      params: Promise.resolve({ sessionId: "other-session" })
    });
    const patchResponse = await sessionRoute.PATCH(
      jsonRequest("/api/sessions/other-session", "PATCH", {
        isOpen: false
      }),
      {
        params: Promise.resolve({ sessionId: "other-session" })
      }
    );
    const representativeResponse = await representativeRoute.PATCH(
      jsonRequest("/api/records/other-session:other-student/representative", "PATCH", {
        attemptId: "other-attempt-1"
      }),
      {
        params: Promise.resolve({ recordId: "other-session:other-student" })
      }
    );

    expect(createResponse.status).toBe(403);
    expect(getResponse.status).toBe(403);
    expect(patchResponse.status).toBe(403);
    expect(representativeResponse.status).toBe(403);
  });

  it("denies cross-school school, class, and student access", async () => {
    const schoolsRoute = await import("../../app/api/schools/route");
    const classesRoute = await import("../../app/api/classes/route");
    const studentsRoute = await import("../../app/api/students/route");

    const schoolGetResponse = await schoolsRoute.GET(
      new NextRequest("http://localhost/api/schools?schoolId=other-school")
    );
    const schoolPostResponse = await schoolsRoute.POST(
      jsonRequest("/api/schools", "POST", {
        id: "other-school",
        name: "Hijacked School"
      })
    );
    const classPostResponse = await classesRoute.POST(
      jsonRequest("/api/classes", "POST", {
        schoolId: "other-school",
        academicYear: 2026,
        gradeLevel: 5,
        classNumber: 2,
        label: "5-2"
      })
    );
    const studentPostResponse = await studentsRoute.POST(
      jsonRequest("/api/students", "POST", {
        classId: "other-class-5-1",
        name: "Intruder",
        sex: "female",
        gradeLevel: 5
      })
    );
    const studentDeleteResponse = await studentsRoute.DELETE(
      new NextRequest("http://localhost/api/students?studentId=other-student")
    );

    expect(schoolGetResponse.status).toBe(403);
    expect(schoolPostResponse.status).toBe(403);
    expect(classPostResponse.status).toBe(403);
    expect(studentPostResponse.status).toBe(403);
    expect(studentDeleteResponse.status).toBe(403);
  });

  it("normalizes student school ownership from the chosen in-scope class", async () => {
    const studentsRoute = await import("../../app/api/students/route");

    const response = await studentsRoute.POST(
      jsonRequest("/api/students", "POST", {
        schoolId: "other-school",
        classId: "demo-class-5-1",
        name: "Normalized Student",
        sex: "female",
        gradeLevel: 5
      })
    );
    const payload = await response.json();
    const createdStudent = createDemoStore({ filePath: storePath })
      .listStudents()
      .find((student) => student.name === "Normalized Student");

    expect(response.status).toBe(201);
    expect(payload.student.schoolId).toBe("demo-school");
    expect(createdStudent?.schoolId).toBe("demo-school");
  });

  it("returns 404 for missing scoped resources instead of surfacing a 500", async () => {
    const classesRoute = await import("../../app/api/classes/route");
    const studentsRoute = await import("../../app/api/students/route");

    const studentGetResponse = await studentsRoute.GET(
      new NextRequest("http://localhost/api/students?classId=missing-class")
    );
    const studentDeleteResponse = await studentsRoute.DELETE(
      new NextRequest("http://localhost/api/students?studentId=missing-student")
    );
    const classDeleteResponse = await classesRoute.DELETE(
      new NextRequest("http://localhost/api/classes?classId=missing-class")
    );

    expect(studentGetResponse.status).toBe(404);
    expect(studentDeleteResponse.status).toBe(404);
    expect(classDeleteResponse.status).toBe(404);
  });
});
