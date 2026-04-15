import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const { requireTeacherRouteSession, createTeacherLiveUpdateStream } = vi.hoisted(() => ({
  requireTeacherRouteSession: vi.fn(),
  createTeacherLiveUpdateStream: vi.fn()
}));

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherRouteSession
}));

vi.mock("../../src/lib/teacher-live-updates", () => ({
  createTeacherLiveUpdateStream
}));

describe("teacher events route", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the auth response when the teacher session is missing", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    });

    const route = await import("../../app/api/teacher/events/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/events"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("opens an event-stream for the authorized teacher", async () => {
    requireTeacherRouteSession.mockResolvedValueOnce({
      ok: true,
      session: {
        email: "teacher@example.com",
        name: "홍교사",
        image: null
      }
    });
    createTeacherLiveUpdateStream.mockReturnValueOnce(new ReadableStream());

    const route = await import("../../app/api/teacher/events/route");
    const response = await route.GET(new NextRequest("http://localhost/api/teacher/events"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(createTeacherLiveUpdateStream).toHaveBeenCalledWith({
      teacherEmail: "teacher@example.com",
      signal: expect.any(AbortSignal)
    });
  });
});
