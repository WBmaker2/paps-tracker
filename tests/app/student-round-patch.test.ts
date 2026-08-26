import { afterEach, describe, expect, it } from "vitest";

import { FOUR_FACTOR_IDS } from "../../src/lib/paps/four-factor-score";
import { buildStudentFinalizedResultView } from "../../src/lib/paps/student-round-submit-view";
import type {
  PAPSAssessmentRound,
  PAPSDemoStoreData,
  PAPSStudentRoundResult
} from "../../src/lib/paps/types";
import { createEmptyPapsStoreData, resetRequestStore } from "../../src/lib/store/paps-memory-store";

const events = ["shuttle-run", "sit-and-reach", "curl-up", "fifty-meter-run"] as const;

const buildSeed = (): PAPSDemoStoreData => {
  const seed = createEmptyPapsStoreData();
  seed.schools.push({ id: "school", name: "학교", teacherIds: ["teacher"], sheetUrl: null, createdAt: "2026-08-26", updatedAt: "2026-08-26" });
  seed.classes.push({ id: "class", schoolId: "school", academicYear: 2026, gradeLevel: 5, classNumber: 1, label: "5-1", active: true });
  seed.teachers.push({ id: "teacher", schoolId: "school", name: "교사", email: "teacher@example.com", createdAt: "2026-08-26", updatedAt: "2026-08-26" });
  seed.students.push({ id: "student", schoolId: "school", classId: "class", studentNumber: 1, name: "학생", sex: "male", gradeLevel: 5, active: true });

  const sessionIdsByFactor = Object.fromEntries(
    FOUR_FACTOR_IDS.map((factorId, index) => [factorId, `session-${index}`])
  ) as PAPSAssessmentRound["sessionIdsByFactor"];
  const selectedEventsByFactor = Object.fromEntries(
    FOUR_FACTOR_IDS.map((factorId, index) => [factorId, events[index]])
  ) as PAPSAssessmentRound["selectedEventsByFactor"];

  seed.sessions.push(...FOUR_FACTOR_IDS.map((factorId, index) => ({
    id: `session-${index}`,
    schoolId: "school",
    teacherId: "teacher",
    academicYear: 2026,
    name: `회차 ${factorId}`,
    gradeLevel: 5 as const,
    sessionType: "official" as const,
    classScope: "single" as const,
    eventId: events[index],
    classTargets: [{ classId: "class", eventId: events[index] }],
    isOpen: true,
    assessmentRoundId: "round",
    factorId
  })));
  seed.attempts.push({ id: "attempt-0", sessionId: "session-0", studentId: "student", eventId: "shuttle-run", unit: "laps", attemptNumber: 1, measurement: 42, createdAt: "2026-08-26" });

  const round: PAPSAssessmentRound = {
    id: "round",
    name: "1회차",
    academicYear: 2026,
    schoolId: "school",
    teacherId: "teacher",
    roundType: "regular",
    roundNumber: 1,
    status: "open",
    classTargets: [{ classId: "class", gradeLevel: 5 }],
    selectedEventsByFactor,
    sessionIdsByFactor,
    ruleVersion: "server",
    ruleSource: "server",
    revision: 1,
    createdAt: "2026-08-26",
    openedAt: "2026-08-26",
    finalizedAt: null,
    archivedAt: null
  };
  const result: PAPSStudentRoundResult = {
    roundId: "round",
    studentId: "student",
    revision: 1,
    previousRevision: null,
    status: "finalized",
    studentSnapshot: { name: "학생", sex: "male", gradeLevel: 5, classId: "class", classNumber: 1, studentNumber: 1 },
    factors: Object.fromEntries(FOUR_FACTOR_IDS.map((factorId, index) => [factorId, {
      factorId,
      eventId: events[index],
      sessionId: `session-${index}`,
      representativeAttemptId: index === 0 ? "attempt-0" : null,
      measurement: index === 0 ? 42 : null,
      factorScore: index === 0 ? 16 : null
    }])) as PAPSStudentRoundResult["factors"],
    fourFactorSubtotal: null,
    normalizedScore: null,
    fourFactorGrade: null,
    ruleVersion: "server",
    ruleSource: "server",
    sourceFingerprint: "fingerprint",
    calculatedAt: "2026-08-26",
    finalizedAt: "2026-08-26",
    finalizedBy: "teacher"
  };
  seed.assessmentRounds = [round];
  seed.studentRoundResults = [result];
  return seed;
};

describe("local student round PATCH response", () => {
  afterEach(() => resetRequestStore());

  it("returns finalized factors with event labels and units", async () => {
    const seed = buildSeed();
    const finalized = buildStudentFinalizedResultView({
      result: seed.studentRoundResults![0]!,
      round: seed.assessmentRounds![0]!,
      studentName: "학생"
    });

    expect(finalized.studentName).toBe("학생");
    expect(finalized.factors["cardiorespiratory-endurance"]).toMatchObject({
      eventLabel: "왕복오래달리기",
      unit: "laps",
      measurement: 42
    });
  });
});
