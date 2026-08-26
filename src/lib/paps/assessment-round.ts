import { createHash } from "node:crypto";

import { getEventDefinition, isEventEligibleForGrade, supportsSessionType } from "./catalog";
import { PAPS_SCORE_RULE_SOURCE, PAPS_SCORE_RULE_VERSION } from "../../data/paps/score-rules";
import {
  calculateEventScore,
  calculateFourFactorScore,
  FOUR_FACTOR_IDS,
  type FourFactorScores
} from "./four-factor-score";
import type {
  EventId,
  PAPSAssessmentRound,
  PAPSAttemptRecord,
  PAPSFactorResultSnapshot,
  PAPSFourFactorId,
  PAPSStudent,
  PAPSStudentRoundResult,
  PAPSSession
} from "./types";

export const FOUR_FACTOR_RULE_VERSION = PAPS_SCORE_RULE_VERSION;
export const FOUR_FACTOR_RULE_SOURCE = PAPS_SCORE_RULE_SOURCE;

const orderedFactorIds = [...FOUR_FACTOR_IDS];

export const assertUniqueRoundClassTargets = (
  targets: Array<{ classId: string }>
): void => {
  if (new Set(targets.map((target) => target.classId)).size !== targets.length) {
    throw new Error("INVALID_REQUEST");
  }
};

export const assertSelectedEventsByFactor = (
  selected: unknown
): Record<PAPSFourFactorId, EventId> => {
  if (!selected || typeof selected !== "object" || Array.isArray(selected)) {
    throw new Error("INVALID_FACTOR_SET");
  }
  const candidate = selected as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  if (keys.length !== orderedFactorIds.length || keys.some((key, i) => key !== [...orderedFactorIds].sort()[i])) {
    throw new Error("INVALID_FACTOR_SET");
  }
  const result = {} as Record<PAPSFourFactorId, EventId>;
  for (const factorId of orderedFactorIds) {
    const eventId = candidate[factorId];
    try {
      getEventDefinition(eventId as EventId);
    } catch {
      throw new Error("INVALID_FACTOR_SET");
    }
    if (getEventDefinition(eventId as EventId).factorId !== factorId) {
      throw new Error("INVALID_FACTOR_SET");
    }
    result[factorId] = eventId as EventId;
  }
  return result;
};

export const assertRoundSessionLink = ({
  round,
  sessions
}: {
  round: Pick<PAPSAssessmentRound, "selectedEventsByFactor" | "sessionIdsByFactor" | "classTargets"> & { id?: string };
  sessions: PAPSSession[];
}): void => {
  const byId = new Map(sessions.map((session) => [session.id, session]));
  for (const factorId of orderedFactorIds) {
    const sessionId = round.sessionIdsByFactor[factorId];
    const eventId = round.selectedEventsByFactor[factorId];
    const session = byId.get(sessionId);
    if (!session || session.assessmentRoundId !== round.id || session.factorId !== factorId || session.eventId !== eventId) {
      throw new Error("SESSION_ROUND_MISMATCH");
    }
  }
};

export const validateRoundEventEligibility = ({
  selectedEventsByFactor,
  classTargets,
  sessionType
}: {
  selectedEventsByFactor: Record<PAPSFourFactorId, EventId>;
  classTargets: Array<{ gradeLevel: PAPSStudent["gradeLevel"] }>;
  sessionType: PAPSSession["sessionType"];
}): void => {
  for (const factorId of orderedFactorIds) {
    const eventId = selectedEventsByFactor[factorId];
    for (const target of classTargets) {
      if (!isEventEligibleForGrade(eventId, target.gradeLevel) || !supportsSessionType(eventId, sessionType)) {
        throw new Error("EVENT_NOT_ELIGIBLE");
      }
    }
  }
};

export const hasRoundSessionStructureChange = (current: PAPSSession, next: PAPSSession): boolean =>
  current.gradeLevel !== next.gradeLevel ||
  current.eventId !== next.eventId ||
  current.sessionType !== next.sessionType ||
  current.classScope !== next.classScope ||
  current.classTargets.length !== next.classTargets.length ||
  current.classTargets.some((target, index) => target.classId !== next.classTargets[index]?.classId || target.eventId !== next.classTargets[index]?.eventId);

const nullSnapshot = (factorId: PAPSFourFactorId, eventId: EventId, sessionId: string): PAPSFactorResultSnapshot => ({
  factorId,
  eventId,
  sessionId,
  representativeAttemptId: null,
  measurement: null,
  factorScore: null
});

export const buildRoundFingerprint = (input: {
  roundId: string;
  roundRevision: number;
  ruleVersion: string;
  factors: Record<PAPSFourFactorId, PAPSFactorResultSnapshot>;
}): string => {
  const source = JSON.stringify([
    input.roundId,
    input.roundRevision,
    input.ruleVersion,
    ...orderedFactorIds.map((factorId) => {
      const factor = input.factors[factorId];
      return [factorId, factor.eventId, factor.sessionId, factor.representativeAttemptId, factor.measurement];
    })
  ]);
  return createHash("sha256").update(source).digest("hex");
};

export const buildStudentRoundResult = ({
  round,
  student,
  sessions,
  records,
  classNumber,
  now = new Date().toISOString(),
  statusOverride
}: {
  round: PAPSAssessmentRound;
  student: PAPSStudent;
  sessions: PAPSSession[];
  records: PAPSAttemptRecord[];
  classNumber?: number | null;
  now?: string;
  statusOverride?: "excluded";
}): Omit<PAPSStudentRoundResult, "revision" | "previousRevision" | "finalizedAt" | "finalizedBy"> => {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const recordBySession = new Map(records.map((record) => [record.sessionId, record]));
  const factors = {} as Record<PAPSFourFactorId, PAPSFactorResultSnapshot>;
  const scoreMap: Partial<FourFactorScores> = {};

  for (const factorId of orderedFactorIds) {
    const sessionId = round.sessionIdsByFactor[factorId];
    const eventId = round.selectedEventsByFactor[factorId];
    const record = recordBySession.get(sessionId);
    const session = sessionById.get(sessionId);
    const representativeAttemptId = record?.representativeAttemptId ?? null;
    const attempt = representativeAttemptId
      ? record?.attempts.find((entry) => entry.id === representativeAttemptId) ?? null
      : null;
    const snapshot: PAPSFactorResultSnapshot = {
      factorId,
      eventId,
      sessionId,
      representativeAttemptId: attempt?.id ?? null,
      measurement: attempt?.measurement ?? null,
      factorScore: null
    };
    if (attempt && session) {
      try {
        snapshot.factorScore = calculateEventScore({
          gradeLevel: student.gradeLevel,
          sex: student.sex,
          eventId: session.eventId,
          measurement: attempt.measurement
        });
        scoreMap[factorId] = snapshot.factorScore;
      } catch {
        snapshot.measurement = null;
        snapshot.representativeAttemptId = null;
      }
    }
    factors[factorId] = snapshot;
  }

  const complete = orderedFactorIds.every((factorId) => factors[factorId].factorScore !== null);
  const calculation = complete ? calculateFourFactorScore(scoreMap as FourFactorScores) : null;
  const sourceFingerprint = buildRoundFingerprint({
    roundId: round.id,
    roundRevision: round.revision,
    ruleVersion: round.ruleVersion,
    factors
  });
  return {
    roundId: round.id,
    studentId: student.id,
    status: statusOverride ?? (complete ? "ready" : "incomplete"),
    studentSnapshot: {
      name: student.name,
      sex: student.sex,
      gradeLevel: student.gradeLevel,
      classId: student.classId,
      classNumber: classNumber ?? null,
      studentNumber: student.studentNumber ?? null
    },
    factors: statusOverride === "excluded"
      ? Object.fromEntries(orderedFactorIds.map((factorId) => [factorId, nullSnapshot(factorId, round.selectedEventsByFactor[factorId], round.sessionIdsByFactor[factorId])])) as Record<PAPSFourFactorId, PAPSFactorResultSnapshot>
      : factors,
    fourFactorSubtotal: statusOverride === "excluded" ? null : calculation?.fourFactorSubtotal ?? null,
    normalizedScore: statusOverride === "excluded" ? null : calculation?.normalizedScore ?? null,
    fourFactorGrade: statusOverride === "excluded" ? null : calculation?.fourFactorGrade ?? null,
    ruleVersion: round.ruleVersion,
    ruleSource: round.ruleSource,
    sourceFingerprint: statusOverride === "excluded" ? null : sourceFingerprint,
    calculatedAt: now
  };
};

export const isRoundResultStale = (saved: PAPSStudentRoundResult, latestFingerprint: string | null): boolean =>
  saved.status === "finalized" && saved.sourceFingerprint !== null && saved.sourceFingerprint !== latestFingerprint;
