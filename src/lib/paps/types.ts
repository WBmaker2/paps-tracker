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
  schoolId?: string;
  teacherId?: string;
  academicYear?: number;
  name?: string;
  isOpen?: boolean;
  createdAt?: string;
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

export type PAPSMeasurementDetail =
  | StepTestMeasurementDetail
  | ComprehensiveFlexibilityMeasurementDetail;

export interface PAPSAttempt {
  id: string;
  attemptNumber: number;
  measurement: number;
  createdAt: string;
  clientSubmissionKey?: string;
  detail?: PAPSMeasurementDetail | null;
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
  createdAt: string;
  updatedAt: string;
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
}
