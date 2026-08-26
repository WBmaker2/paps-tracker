import { describe, expect, it } from "vitest";
import { createEmptyPapsStoreData, createPapsMemoryStore } from "../../src/lib/store/paps-memory-store";
import type { PAPSAssessmentRound, PAPSSession } from "../../src/lib/paps/types";
import { FOUR_FACTOR_IDS } from "../../src/lib/paps/four-factor-score";

const buildFixture = () => {
  const seed = createEmptyPapsStoreData();
  seed.schools.push({ id: "school", name: "학교", teacherIds: ["teacher"], sheetUrl: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  seed.classes.push({ id: "class", schoolId: "school", academicYear: 2026, gradeLevel: 5, classNumber: 1, label: "5-1", active: true });
  seed.teachers.push({ id: "teacher", schoolId: "school", name: "교사", email: "teacher@example.com", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
  seed.students.push({ id: "student", schoolId: "school", classId: "class", name: "학생", sex: "male", gradeLevel: 5, studentNumber: 1, active: true });
  const events = ["shuttle-run", "sit-and-reach", "curl-up", "fifty-meter-run"] as const;
  const sessions = events.map((eventId, index): PAPSSession => ({ id: `session-${index}`, schoolId: "school", teacherId: "teacher", academicYear: 2026, name: eventId, gradeLevel: 5, sessionType: "official", classScope: "single", eventId, classTargets: [{ classId: "class", eventId }], isOpen: true, assessmentRoundId: "round", factorId: FOUR_FACTOR_IDS[index] }));
  seed.sessions.push(...sessions);
  return { seed, sessions };
};

describe("assessment round memory store", () => {
  it("keeps incomplete null, finalizes, replays, and marks changed source stale", () => {
    const { seed, sessions } = buildFixture();
    const store = createPapsMemoryStore(seed);
    const round: PAPSAssessmentRound = {
      id: "round", name: "4요인", academicYear: 2026, schoolId: "school", teacherId: "teacher", roundType: "regular", roundNumber: 1, status: "open",
      classTargets: [{ classId: "class", gradeLevel: 5 }], selectedEventsByFactor: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, sessions[index]!.eventId])) as PAPSAssessmentRound["selectedEventsByFactor"],
      sessionIdsByFactor: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, sessions[index]!.id])) as PAPSAssessmentRound["sessionIdsByFactor"],
      ruleVersion: "school-health-rule-2025-03-10-four-factor-v1", ruleSource: "test", revision: 1, createdAt: "2026-01-01T00:00:00.000Z", openedAt: "2026-01-01T00:00:00.000Z", finalizedAt: null, archivedAt: null
    };
    store.createAssessmentRound({ round, sessions });
    expect(store.previewAssessmentRound({ roundId: "round" })[0]?.status).toBe("incomplete");
    const values = [40, 10, 50, 9.5];
    sessions.forEach((session, index) => {
      const record = store.appendAttempt({ id: `attempt-${index}`, sessionId: session.id, studentId: "student", measurement: values[index]!, createdAt: `2026-01-01T00:0${index}:00.000Z` });
      store.selectRepresentativeAttempt({ sessionId: session.id, studentId: "student", attemptId: record.attempts[0]!.id, changedByTeacherId: "teacher", createdAt: `2026-01-01T01:0${index}:00.000Z` });
    });
    expect(store.listStudentRoundResults("round")).toHaveLength(1);
    expect(store.listStudentRoundResults("round")[0]?.status).toBe("ready");
    expect(store.previewAssessmentRound({ roundId: "round" })[0]?.status).toBe("ready");
    const first = store.finalizeStudentRound({ roundId: "round", studentId: "student", expectedRevision: 0, teacherId: "teacher", idempotencyKey: "k1" });
    expect(first.result.status).toBe("finalized");
    const replay = store.finalizeStudentRound({ roundId: "round", studentId: "student", expectedRevision: 1, teacherId: "teacher", idempotencyKey: "k2" });
    expect(replay.replayed).toBe(true);
    store.updateAttempt({ attemptId: "attempt-0", sessionId: "session-0", studentId: "student", measurement: 41 });
    expect(store.getStudentRoundResult({ roundId: "round", studentId: "student" })?.status).toBe("stale");
    const second = store.finalizeStudentRound({ roundId: "round", studentId: "student", expectedRevision: 1, teacherId: "teacher", idempotencyKey: "k3" });
    expect(second.result.revision).toBe(2);
  });
});
