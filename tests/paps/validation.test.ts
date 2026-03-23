import {
  appendAttempt,
  assertAttemptInputAllowed,
  createAttemptRecord,
  validateSession
} from "../../src/lib/paps/validation";
import type { PAPSSession, PAPSStudent } from "../../src/lib/paps/types";

const student: PAPSStudent = {
  id: "student-1",
  name: "Kim",
  sex: "female",
  gradeLevel: 5,
  classId: "5-1"
};

describe("PAPS validation", () => {
  it("rejects event selection outside the configured session event", () => {
    const session: PAPSSession = {
      id: "session-1",
      gradeLevel: 5,
      sessionType: "official",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "5-1", eventId: "shuttle-run" }]
    };

    expect(() =>
      assertAttemptInputAllowed({
        session,
        student,
        input: {
          measurement: 42,
          submittedEventId: "sit-and-reach"
        }
      })
    ).toThrow("Students cannot submit a different event than the session event.");
  });

  it("rejects a two-class session with different events", () => {
    const session: PAPSSession = {
      id: "session-2",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "split",
      eventId: "shuttle-run",
      classTargets: [
        { classId: "5-1", eventId: "shuttle-run" },
        { classId: "5-2", eventId: "sit-and-reach" }
      ]
    };

    expect(() => validateSession(session)).toThrow(
      "Split sessions must use the same event for both classes."
    );
  });

  it("rejects duplicate class targets in a split session", () => {
    const session: PAPSSession = {
      id: "session-2a",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "split",
      eventId: "shuttle-run",
      classTargets: [
        { classId: "5-1", eventId: "shuttle-run" },
        { classId: "5-1", eventId: "shuttle-run" }
      ]
    };

    expect(() => validateSession(session)).toThrow(
      "Split sessions must target two different classes."
    );
  });

  it("rejects a single-class session when the class target event differs from the session event", () => {
    const session: PAPSSession = {
      id: "session-2b",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "shuttle-run",
      classTargets: [{ classId: "5-1", eventId: "sit-and-reach" }]
    };

    expect(() => validateSession(session)).toThrow(
      "Single-class sessions must use the configured session event."
    );
  });

  it("keeps all attempts and marks no representative by default", () => {
    const session: PAPSSession = {
      id: "session-3",
      gradeLevel: 5,
      sessionType: "practice",
      classScope: "single",
      eventId: "sit-and-reach",
      classTargets: [{ classId: "5-1", eventId: "sit-and-reach" }]
    };

    const emptyRecord = createAttemptRecord(session, student);
    const withFirstAttempt = appendAttempt(emptyRecord, {
      id: "attempt-1",
      measurement: 11,
      createdAt: "2026-03-23T10:00:00.000Z"
    });
    const withSecondAttempt = appendAttempt(withFirstAttempt, {
      id: "attempt-2",
      measurement: 13,
      createdAt: "2026-03-23T10:01:00.000Z"
    });

    expect(withSecondAttempt.attempts).toHaveLength(2);
    expect(withSecondAttempt.attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(withSecondAttempt.representativeAttemptId).toBeNull();
  });

  it("enforces grade-specific event eligibility", () => {
    const session: PAPSSession = {
      id: "session-4",
      gradeLevel: 3,
      sessionType: "official",
      classScope: "single",
      eventId: "long-run-walk",
      classTargets: [{ classId: "3-1", eventId: "long-run-walk" }]
    };

    expect(() => validateSession(session)).toThrow(
      "Event long-run-walk is not eligible for grade 3."
    );
  });
});
