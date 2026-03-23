import { describe, expect, it } from "vitest";

import { vi } from "vitest";

import type { PAPSSession } from "../../src/lib/paps/types";

vi.mock("../../src/lib/teacher-auth", () => ({
  requireTeacherSession: vi.fn(async () => ({
    email: "demo-teacher@example.com",
    name: "Demo Teacher",
    image: null
  }))
}));

describe("teacher results session selection", () => {
  it("prefers the newest open session and otherwise falls back to the newest created session", async () => {
    const { selectPrimaryResultsSession } = await import("../../src/lib/teacher-results");

    const sessions: PAPSSession[] = [
      {
        id: "closed-newer",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "Closed Newer",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
        isOpen: false,
        createdAt: "2026-03-23T12:00:00.000Z"
      },
      {
        id: "open-latest",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "Open Latest",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
        isOpen: true,
        createdAt: "2026-03-23T11:00:00.000Z"
      },
      {
        id: "open-older",
        schoolId: "demo-school",
        teacherId: "demo-teacher",
        academicYear: 2026,
        name: "Open Older",
        gradeLevel: 5,
        sessionType: "official",
        classScope: "single",
        eventId: "sit-and-reach",
        classTargets: [{ classId: "demo-class-5-1", eventId: "sit-and-reach" }],
        isOpen: true,
        createdAt: "2026-03-23T10:00:00.000Z"
      }
    ];

    expect(selectPrimaryResultsSession(sessions)?.id).toBe("open-latest");
    expect(selectPrimaryResultsSession(sessions.map((session) => ({ ...session, isOpen: false })))?.id).toBe(
      "closed-newer"
    );
  });
});
