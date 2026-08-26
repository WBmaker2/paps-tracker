import { randomUUID } from "node:crypto";

import {
  assertRoundSessionLink,
  buildStudentRoundResult,
  isRoundResultStale,
  validateRoundEventEligibility
} from "../paps/assessment-round";
import { FOUR_FACTOR_IDS } from "../paps/four-factor-score";
import type {
  PAPSAssessmentRound,
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSFourFactorId,
  PAPSStudent,
  PAPSStudentRoundResult,
  PAPSSession,
  AssessmentRoundStatus
} from "../paps/types";

export interface AssessmentRoundMemoryStore {
  replaceAssessmentRoundData(rounds: PAPSAssessmentRound[], results: PAPSStudentRoundResult[]): void;
  listAssessmentRounds(): PAPSAssessmentRound[];
  getAssessmentRound(roundId: string): PAPSAssessmentRound;
  saveAssessmentRound(round: PAPSAssessmentRound): PAPSAssessmentRound;
  createAssessmentRound(input: {
    round: PAPSAssessmentRound;
    sessions: PAPSSession[];
    idempotencyKey?: string;
  }): { round: PAPSAssessmentRound; sessions: PAPSSession[] };
  listStudentRoundResults(roundId: string): PAPSStudentRoundResult[];
  getStudentRoundResult(input: { roundId: string; studentId: string }): PAPSStudentRoundResult | null;
  previewAssessmentRound(input: { roundId: string; studentIds?: string[] }): PAPSStudentRoundResult[];
  saveStudentRoundResult(input: {
    result: PAPSStudentRoundResult;
    expectedRevision: number;
    idempotencyKey?: string;
  }): { result: PAPSStudentRoundResult; replayed: boolean };
  finalizeStudentRound(input: {
    roundId: string;
    studentId: string;
    expectedRevision: number;
    teacherId: string;
    idempotencyKey?: string;
  }): { result: PAPSStudentRoundResult; replayed: boolean };
  excludeStudentRound(input: {
    roundId: string;
    studentId: string;
    expectedRevision: number;
    teacherId: string;
    reason: string;
    idempotencyKey?: string;
  }): { result: PAPSStudentRoundResult; replayed: boolean };
  updateAssessmentRoundStatus(input: {
    roundId: string;
    expectedRevision: number;
    status: AssessmentRoundStatus;
  }): PAPSAssessmentRound;
}

type RoundStoreDeps = {
  initialRounds?: PAPSAssessmentRound[];
  initialResults?: PAPSStudentRoundResult[];
  listSessions: () => PAPSSession[];
  listStudents: () => PAPSStudent[];
  getClass: (classId: string) => PAPSClassroom;
  listSessionRecords: (sessionId: string) => PAPSAttemptRecord[];
  saveSessions: (sessions: PAPSSession[]) => PAPSSession[];
  onChange?: (rounds: PAPSAssessmentRound[], results: PAPSStudentRoundResult[]) => void;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();

export const createAssessmentRoundMemoryStore = (deps: RoundStoreDeps): AssessmentRoundMemoryStore => {
  let rounds = clone(deps.initialRounds ?? []);
  let results = clone(deps.initialResults ?? []);
  const idempotency = new Map<string, { hash: string; result: PAPSStudentRoundResult }>();
  const createIdempotency = new Map<string, { hash: string; created: { round: PAPSAssessmentRound; sessions: PAPSSession[] } }>();

  const getRound = (roundId: string): PAPSAssessmentRound => {
    const round = rounds.find((entry) => entry.id === roundId);
    if (!round) throw new Error("ROUND_NOT_FOUND");
    return clone(round);
  };

  const listRoundSessions = (round: PAPSAssessmentRound): PAPSSession[] => {
    const sessions = deps.listSessions().filter((session) => Object.values(round.sessionIdsByFactor).includes(session.id));
    assertRoundSessionLink({ round, sessions });
    return sessions;
  };

  const studentsForRound = (round: PAPSAssessmentRound): PAPSStudent[] => {
    const classIds = new Set(round.classTargets.map((target) => target.classId));
    return deps.listStudents().filter((student) => student.active !== false && classIds.has(student.classId));
  };

  const latestResult = (roundId: string, studentId: string): PAPSStudentRoundResult | null => {
    const matches = results.filter((result) => result.roundId === roundId && result.studentId === studentId);
    return matches.sort((a, b) => b.revision - a.revision)[0] ? clone(matches.sort((a, b) => b.revision - a.revision)[0]) : null;
  };
  const notify = () => deps.onChange?.(clone(rounds), clone(results));

  const previewStudent = (round: PAPSAssessmentRound, student: PAPSStudent): PAPSStudentRoundResult => {
    const sessions = listRoundSessions(round);
    const records = sessions.map((session) => deps.listSessionRecords(session.id).find((record) => record.studentId === student.id) ?? {
      sessionId: session.id,
      studentId: student.id,
      eventId: session.eventId,
      unit: "점" as const,
      attempts: [],
      representativeAttemptId: null
    });
    const built = buildStudentRoundResult({
      round,
      student,
      sessions,
      records,
      classNumber: deps.getClass(student.classId).classNumber
    });
    const prior = latestResult(round.id, student.id);
    const result: PAPSStudentRoundResult = {
      ...built,
      revision: prior?.revision ?? 0,
      previousRevision: prior?.previousRevision ?? null,
      finalizedAt: prior?.finalizedAt ?? null,
      finalizedBy: prior?.finalizedBy ?? null
    };
    if (prior?.status === "excluded") return prior;
    if (prior?.status === "finalized" && prior.sourceFingerprint === built.sourceFingerprint) return prior;
    if (prior?.status === "finalized" && isRoundResultStale(prior, built.sourceFingerprint)) {
      result.status = "stale";
      // Keep the latest calculation in preview while the persisted finalized
      // revision remains available through getStudentRoundResult/history.
      result.revision = prior.revision;
      result.previousRevision = prior.previousRevision;
      result.finalizedAt = prior.finalizedAt;
      result.finalizedBy = prior.finalizedBy;
    }
    return result;
  };

  const saveResult = (input: {
    result: PAPSStudentRoundResult;
    expectedRevision: number;
    idempotencyKey?: string;
  }): { result: PAPSStudentRoundResult; replayed: boolean } => {
    const key = input.idempotencyKey?.trim();
    const hash = JSON.stringify({ roundId: input.result.roundId, studentId: input.result.studentId, expectedRevision: input.expectedRevision, status: input.result.status, fingerprint: input.result.sourceFingerprint });
    if (key) {
      const priorRequest = idempotency.get(key);
      if (priorRequest) {
        if (priorRequest.hash !== hash) throw new Error("IDEMPOTENCY_KEY_REUSED");
        return { result: clone(priorRequest.result), replayed: true };
      }
    }
    const current = latestResult(input.result.roundId, input.result.studentId);
    const currentRevision = current?.revision ?? 0;
    if (currentRevision !== input.expectedRevision) throw new Error("REVISION_CONFLICT");
    const next: PAPSStudentRoundResult = {
      ...clone(input.result),
      revision: currentRevision + 1,
      previousRevision: currentRevision === 0 ? null : currentRevision,
      finalizedAt: input.result.status === "finalized" || input.result.status === "excluded" ? input.result.finalizedAt : null,
      finalizedBy: input.result.status === "finalized" || input.result.status === "excluded" ? input.result.finalizedBy : null
    };
    results.push(next);
    notify();
    if (key) idempotency.set(key, { hash, result: clone(next) });
    return { result: clone(next), replayed: false };
  };

  return {
    replaceAssessmentRoundData: (nextRounds, nextResults) => {
      rounds = clone(nextRounds);
      results = clone(nextResults);
      idempotency.clear();
      createIdempotency.clear();
    },
    listAssessmentRounds: () => clone(rounds),
    getAssessmentRound: getRound,
    saveAssessmentRound: (round) => {
      const normalized = clone(round);
      rounds = [...rounds.filter((entry) => entry.id !== round.id), normalized];
      notify();
      return clone(normalized);
    },
    createAssessmentRound: ({ round, sessions, idempotencyKey }) => {
      const createHash = JSON.stringify({ name: round.name, academicYear: round.academicYear, roundType: round.roundType, roundNumber: round.roundNumber, classTargets: round.classTargets, selectedEventsByFactor: round.selectedEventsByFactor, sessionType: sessions[0]?.sessionType });
      if (idempotencyKey) {
        const previous = createIdempotency.get(idempotencyKey);
        if (previous) {
          if (previous.hash !== createHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
          return clone(previous.created);
        }
        const persisted = rounds.find((entry) => entry.creationIdempotencyKey === idempotencyKey);
        if (persisted) {
          const persistedSessions = deps.listSessions().filter((session) => Object.values(persisted.sessionIdsByFactor).includes(session.id));
          const persistedCreated = { round: persisted, sessions: persistedSessions };
          if (JSON.stringify({ name: persisted.name, academicYear: persisted.academicYear, roundType: persisted.roundType, roundNumber: persisted.roundNumber, classTargets: persisted.classTargets, selectedEventsByFactor: persisted.selectedEventsByFactor, sessionType: persistedSessions[0]?.sessionType }) !== createHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
          return clone(persistedCreated);
        }
      }
      if (round.classTargets.length === 0) throw new Error("INVALID_REQUEST");
      const selected = round.selectedEventsByFactor;
      for (const factorId of FOUR_FACTOR_IDS) {
        if (!selected[factorId]) throw new Error("INVALID_FACTOR_SET");
      }
      const classes = round.classTargets.map((target) => deps.getClass(target.classId));
      validateRoundEventEligibility({
        selectedEventsByFactor: selected,
        classTargets: classes,
        sessionType: sessions[0]?.sessionType ?? "practice"
      });
      if (sessions.length !== 4) throw new Error("SESSION_ROUND_MISMATCH");
      assertRoundSessionLink({ round, sessions });
      rounds = [...rounds.filter((entry) => entry.id !== round.id), clone(round)];
      const savedSessions = deps.saveSessions(sessions);
      notify();
      const created = { round: clone(round), sessions: clone(savedSessions) };
      if (idempotencyKey) createIdempotency.set(idempotencyKey, { hash: createHash, created });
      return created;
    },
    listStudentRoundResults: (roundId) => {
      const round = getRound(roundId);
      // The teacher matrix must include ready students before any snapshot has
      // been persisted; persisted revisions only enrich the preview state.
      return studentsForRound(round).map((student) => previewStudent(round, student));
    },
    getStudentRoundResult: ({ roundId, studentId }) => {
      const round = getRound(roundId);
      const student = studentsForRound(round).find((entry) => entry.id === studentId);
      return student ? previewStudent(round, student) : latestResult(roundId, studentId);
    },
    previewAssessmentRound: ({ roundId, studentIds }) => {
      const round = getRound(roundId);
      const allowedIds = studentIds ? new Set(studentIds) : null;
      return studentsForRound(round).filter((student) => !allowedIds || allowedIds.has(student.id)).map((student) => previewStudent(round, student));
    },
    saveStudentRoundResult: saveResult,
    finalizeStudentRound: ({ roundId, studentId, expectedRevision, teacherId, idempotencyKey }) => {
      const round = getRound(roundId);
      if (round.status === "archived") throw new Error("ROUND_NOT_EDITABLE");
      const student = studentsForRound(round).find((entry) => entry.id === studentId);
      if (!student) throw new Error("STUDENT_NOT_FOUND");
      const preview = previewStudent(round, student);
      const previous = latestResult(roundId, studentId);
      if (previous?.status === "finalized" && previous.sourceFingerprint === preview.sourceFingerprint) {
        return { result: previous, replayed: true };
      }
      if (preview.status === "excluded") throw new Error("RESULT_EXCLUDED");
      if (preview.status !== "ready" && preview.status !== "stale") throw new Error("RESULT_INCOMPLETE");
      const finalized: PAPSStudentRoundResult = { ...preview, status: "finalized", finalizedAt: now(), finalizedBy: teacherId };
      return saveResult({ result: finalized, expectedRevision, idempotencyKey });
    },
    excludeStudentRound: ({ roundId, studentId, expectedRevision, teacherId, reason, idempotencyKey }) => {
      if (!reason.trim() || reason.trim().length > 500) throw new Error("INVALID_REQUEST");
      const round = getRound(roundId);
      const student = studentsForRound(round).find((entry) => entry.id === studentId);
      if (!student) throw new Error("STUDENT_NOT_FOUND");
      const sessions = listRoundSessions(round);
      const preview = buildStudentRoundResult({ round, student, sessions, records: [], statusOverride: "excluded" });
      return saveResult({
        result: {
          ...preview,
          status: "excluded",
          revision: 0,
          previousRevision: null,
          finalizedAt: now(),
          finalizedBy: teacherId
        },
        expectedRevision,
        idempotencyKey
      });
    },
    updateAssessmentRoundStatus: ({ roundId, expectedRevision, status }) => {
      const round = getRound(roundId);
      if (round.revision !== expectedRevision) throw new Error("REVISION_CONFLICT");
      if (round.status === "archived" && status !== "archived") throw new Error("ROUND_NOT_EDITABLE");
      const updated: PAPSAssessmentRound = {
        ...round,
        status,
        revision: round.revision + 1,
        openedAt: status === "open" && !round.openedAt ? now() : round.openedAt,
        finalizedAt: status === "finalized" ? now() : round.finalizedAt,
        archivedAt: status === "archived" ? now() : round.archivedAt
      };
      rounds = [...rounds.filter((entry) => entry.id !== roundId), updated];
      notify();
      return clone(updated);
    }
  };
};

export const createAssessmentRoundId = (): string => randomUUID();
