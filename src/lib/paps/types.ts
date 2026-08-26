export type GradeLevel = 3 | 4 | 5 | 6;

export type StudentSex = "male" | "female";

export type SessionType = "official" | "practice";

export type ClassScope = "single" | "split";

export type EventId =
  | "sit-and-reach"
  | "shuttle-run"
  | "long-run-walk"
  | "step-test"
  | "comprehensive-flexibility"
  | "curl-up"
  | "grip-strength"
  | "fifty-meter-run"
  | "standing-long-jump";

/** 체지방을 제외하고 회차 점수에 포함하는 네 가지 체력요인. */
export type PAPSFourFactorId =
  | "cardiorespiratory-endurance"
  | "flexibility"
  | "strength-endurance"
  | "power";

export type EventUnit = "cm" | "laps" | "seconds" | "kg" | "reps" | "PEI" | "점";

export type BetterDirection = "higher" | "lower";

export type OfficialGrade = 1 | 2 | 3 | 4 | 5;

export interface PAPSStudent {
  id: string;
  name: string;
  sex: StudentSex;
  gradeLevel: GradeLevel;
  classId: string;
  schoolId?: string;
  studentNumber?: number;
  active?: boolean;
}

export interface PAPSClassTarget {
  classId: string;
  eventId: EventId;
}

export interface PAPSSession {
  id: string;
  gradeLevel: GradeLevel;
  sessionType: SessionType;
  classScope: ClassScope;
  eventId: EventId;
  classTargets: PAPSClassTarget[];
  sessionGroupId?: string;
  sessionGroupName?: string;
  sessionGroupOrder?: number;
  schoolId?: string;
  teacherId?: string;
  academicYear?: number;
  name?: string;
  isOpen?: boolean;
  createdAt?: string;
  /** Explicit link used only by four-factor assessment rounds. */
  assessmentRoundId?: string;
  factorId?: PAPSFourFactorId;
}

export type AssessmentRoundType = "regular" | "followUp";
export type AssessmentRoundStatus = "draft" | "open" | "review" | "finalized" | "archived";
export type StudentRoundResultStatus =
  | "incomplete"
  | "excluded"
  | "ready"
  | "finalized"
  | "stale";

export interface PAPSAssessmentRoundClassTarget {
  classId: string;
  gradeLevel: GradeLevel;
}

export interface PAPSAssessmentRound {
  id: string;
  name: string;
  academicYear: number;
  schoolId: string;
  teacherId: string;
  roundType: AssessmentRoundType;
  roundNumber: number;
  status: AssessmentRoundStatus;
  classTargets: PAPSAssessmentRoundClassTarget[];
  selectedEventsByFactor: Record<PAPSFourFactorId, EventId>;
  sessionIdsByFactor: Record<PAPSFourFactorId, string>;
  ruleVersion: string;
  ruleSource: string;
  revision: number;
  createdAt: string;
  openedAt: string | null;
  finalizedAt: string | null;
  archivedAt: string | null;
  /** Server-only replay key; omitted from learner-facing responses when desired. */
  creationIdempotencyKey?: string;
}

export interface PAPSFactorResultSnapshot {
  factorId: PAPSFourFactorId;
  eventId: EventId;
  sessionId: string;
  representativeAttemptId: string | null;
  measurement: number | null;
  factorScore: number | null;
}

export interface PAPSStudentRoundResult {
  roundId: string;
  studentId: string;
  revision: number;
  previousRevision: number | null;
  status: StudentRoundResultStatus;
  studentSnapshot: {
    name: string;
    sex: StudentSex;
    gradeLevel: GradeLevel;
    classId: string;
    classNumber: number | null;
    studentNumber: number | null;
  };
  factors: Record<PAPSFourFactorId, PAPSFactorResultSnapshot>;
  fourFactorSubtotal: number | null;
  normalizedScore: number | null;
  fourFactorGrade: OfficialGrade | null;
  ruleVersion: string;
  ruleSource: string;
  sourceFingerprint: string | null;
  calculatedAt: string | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
}

export interface PAPSStudentRoundSubmitFactorView {
  factorId: PAPSFourFactorId;
  eventId: EventId;
  eventLabel: string;
  unit: EventUnit;
  representativeAttemptId: string | null;
  measurement: number | null;
  factorScore: number | null;
}

export type PAPSStudentRoundSubmitFactors = Record<PAPSFourFactorId, PAPSStudentRoundSubmitFactorView>;

export interface PAPSStudentRoundSubmitFinalizedResult {
  roundId: string;
  roundName: string;
  studentName: string;
  status: "finalized";
  factors: PAPSStudentRoundSubmitFactors;
  fourFactorSubtotal: number | null;
  normalizedScore: number | null;
  fourFactorGrade: OfficialGrade | null;
  ruleVersion: string;
  calculatedAt: string | null;
  finalizedAt: string | null;
}

export interface PAPSStudentRoundSubmitProgress {
  roundId: string;
  roundName: string;
  status: StudentRoundResultStatus;
  factors: Array<{
    factorId: PAPSFourFactorId;
    eventId: EventId;
    eventLabel: string;
    complete: boolean;
  }>;
  roundProgress: { completed: number; total: 4; nextFactorId: PAPSFourFactorId | null; nextEventLabel: string | null };
}

export interface PAPSSubmissionInput {
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
  submittedEventId?: EventId;
  submittedSessionType?: SessionType;
}

export interface StepTestMeasurementDetail {
  kind: "step-test";
  recoveryHeartRates: [number, number, number];
}

export interface ComprehensiveFlexibilitySectionDetail {
  right: boolean;
  left: boolean;
}

export interface ComprehensiveFlexibilityMeasurementDetail {
  kind: "comprehensive-flexibility";
  shoulder: ComprehensiveFlexibilitySectionDetail;
  trunk: ComprehensiveFlexibilitySectionDetail;
  side: ComprehensiveFlexibilitySectionDetail;
  lowerBody: ComprehensiveFlexibilitySectionDetail;
}

export interface GripStrengthMeasurementDetail {
  kind: "grip-strength";
  right: number;
  left: number;
}

export type PAPSMeasurementDetail =
  | StepTestMeasurementDetail
  | ComprehensiveFlexibilityMeasurementDetail
  | GripStrengthMeasurementDetail;

export interface PAPSAttempt {
  id: string;
  attemptNumber: number;
  measurement: number;
  createdAt: string;
  clientSubmissionKey?: string;
  detail?: PAPSMeasurementDetail | null;
}

export interface PAPSStudentEventHistoryAttempt extends PAPSAttempt {
  sessionId: string;
  sessionName: string;
  sessionType: SessionType;
  eventId: EventId;
  academicYear?: number;
  isCurrentSession: boolean;
}

export interface PAPSAttemptRecord {
  sessionId: string;
  studentId: string;
  eventId: EventId;
  unit: EventUnit;
  attempts: PAPSAttempt[];
  representativeAttemptId: string | null;
}

export interface PAPSAttemptDraft {
  id: string;
  measurement: number;
  createdAt: string;
  detail?: PAPSMeasurementDetail | null;
}

export interface PAPSEventDefinition {
  id: EventId;
  factorId: PAPSFourFactorId;
  label: string;
  unit: EventUnit;
  betterDirection: BetterDirection;
  supportedGrades: GradeLevel[];
  supportedSessionTypes: SessionType[];
  measurementConstraints: {
    min: number;
    max: number;
    precision: number;
  };
}

export interface OfficialGradeBand {
  grade: OfficialGrade;
  min?: number;
  max?: number;
}

export interface OfficialGradeRule {
  eventId: EventId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
  bands: OfficialGradeBand[];
}

export interface PAPSRecordSummary {
  sessionId: string;
  studentId: string;
  eventId: EventId;
  unit: EventUnit;
  sessionType: SessionType;
  attempts: PAPSAttempt[];
  representativeAttemptId: string | null;
  representativeMeasurement: number | null;
  improvement: number | null;
  officialGrade?: OfficialGrade;
}

export interface PAPSSchool {
  id: string;
  name: string;
  teacherIds: string[];
  sheetUrl: string | null;
  teacherReturnPin?: PAPSTeacherReturnPin | null;
  createdAt: string;
  updatedAt: string;
}

export interface PAPSTeacherReturnPin {
  algorithm: "hmac-sha256-v1";
  salt: string;
  hash: string;
  updatedAt: string;
  updatedByTeacherEmail: string;
}

export interface PAPSClassroom {
  id: string;
  schoolId: string;
  academicYear: number;
  gradeLevel: GradeLevel;
  classNumber: number;
  label: string;
  active: boolean;
}

export interface PAPSTeacher {
  id: string;
  schoolId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface PAPSStoredAttempt {
  id: string;
  sessionId: string;
  studentId: string;
  eventId: EventId;
  unit: EventUnit;
  attemptNumber: number;
  measurement: number;
  createdAt: string;
  clientSubmissionKey?: string;
  detail?: PAPSMeasurementDetail | null;
}

export type PAPSSyncState = "pending" | "synced" | "failed";

export interface PAPSSyncStatusRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: PAPSSyncState;
  attemptId: string | null;
  updatedAt: string;
}

export interface PAPSSyncErrorLog {
  id: string;
  sessionId: string;
  studentId: string;
  syncStatusId: string;
  message: string;
  createdAt: string;
}

export interface PAPSRepresentativeSelectionAuditLog {
  id: string;
  sessionId: string;
  studentId: string;
  eventId: EventId;
  previousAttemptId: string | null;
  selectedAttemptId: string | null;
  changedByTeacherId: string;
  reason?: string;
  createdAt: string;
}

export interface PAPSDemoStoreData {
  version: number;
  schools: PAPSSchool[];
  classes: PAPSClassroom[];
  teachers: PAPSTeacher[];
  students: PAPSStudent[];
  sessions: PAPSSession[];
  attempts: PAPSStoredAttempt[];
  syncStatuses: PAPSSyncStatusRecord[];
  syncErrorLogs: PAPSSyncErrorLog[];
  representativeSelectionAuditLogs: PAPSRepresentativeSelectionAuditLog[];
  assessmentRounds?: PAPSAssessmentRound[];
  studentRoundResults?: PAPSStudentRoundResult[];
}
