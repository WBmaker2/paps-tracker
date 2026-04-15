import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  forbiddenTeacherRouteResponse,
  getAuthorizedTeacherRouteContext,
  notFoundTeacherRouteResponse
} from "../../src/lib/teacher-route-context";

describe("teacher route context helpers", () => {
  it("returns store, bootstrap, and teacher for authorized teachers", async () => {
    const store = {
      getTeacherBootstrap: async ({ teacherEmail }: { teacherEmail: string }) => ({
        teacher: {
          id: "teacher-1",
          schoolId: "school-1",
          name: "Teacher Kim",
          email: teacherEmail,
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        },
        school: null,
        schools: [],
        classes: [],
        teachers: [],
        students: [],
        sessions: [],
        attempts: [],
        syncStatuses: [],
        syncErrorLogs: [],
        representativeSelectionAuditLogs: []
      })
    };

    const result = await getAuthorizedTeacherRouteContext({
      request: new NextRequest("http://localhost/api/classes"),
      teacherEmail: "teacher@example.com",
      createStore: async () => store
    });

    expect(result.store).toBe(store);
    expect(result.teacher.schoolId).toBe("school-1");
    expect(result.bootstrap.teacher?.email).toBe("teacher@example.com");
  });

  it("throws Forbidden when bootstrap teacher has no school scope", async () => {
    await expect(
      getAuthorizedTeacherRouteContext({
        request: new NextRequest("http://localhost/api/classes"),
        teacherEmail: "teacher@example.com",
        createStore: async () => ({
          getTeacherBootstrap: async () => ({
            teacher: null,
            school: null,
            schools: [],
            classes: [],
            teachers: [],
            students: [],
            sessions: [],
            attempts: [],
            syncStatuses: [],
            syncErrorLogs: [],
            representativeSelectionAuditLogs: []
          })
        })
      })
    ).rejects.toThrow("Forbidden");
  });

  it("builds consistent forbidden and not-found responses", async () => {
    const forbidden = forbiddenTeacherRouteResponse();
    const notFound = notFoundTeacherRouteResponse("missing");

    await expect(forbidden.json()).resolves.toEqual({ error: "Forbidden" });
    await expect(notFound.json()).resolves.toEqual({ error: "missing" });
    expect(forbidden.status).toBe(403);
    expect(notFound.status).toBe(404);
  });
});
