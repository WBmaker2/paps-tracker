import type { PAPSMeasurementDetail } from "../paps/types";
import type {
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSRepresentativeSelectionAuditLog,
  PAPSSchool,
  PAPSSession,
  PAPSTeacher,
  PAPSSyncErrorLog,
  PAPSSyncStatusRecord,
  PAPSStoredAttempt,
  PAPSStudentEventHistoryAttempt,
  PAPSStudent,
  PAPSAssessmentRound,
  PAPSStudentRoundResult
} from "../paps/types";
import type { AssessmentRoundMemoryStore } from "./paps-memory-round-store";

export interface AppendAttemptInput {
  id: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
  clientSubmissionKey?: string | null;
  detail?: PAPSMeasurementDetail | null;
}

export interface UpdateAttemptInput {
  attemptId: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  clientSubmissionKey?: string | null;
  detail?: PAPSMeasurementDetail | null;
}

export interface RecordSelector {
  sessionId: string;
  studentId: string;
}

export interface SelectRepresentativeAttemptInput extends RecordSelector {
  attemptId: string | null;
  changedByTeacherId: string;
  createdAt: string;
  reason?: string;
}

export interface TeacherSummaryInput {
  teacherEmail: string;
}

export interface TeacherBootstrap {
  teacher: PAPSTeacher | null;
  school: PAPSSchool | null;
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

export interface StudentSessionClassSection {
  classId: string;
  label: string;
  students: Array<Pick<PAPSStudent, "id" | "name">>;
}

export interface StudentSessionView {
  session: PAPSSession;
  classSections: StudentSessionClassSection[];
  teacherReturnPinConfigured?: boolean;
}

export interface StudentSessionGroupView {
  groupId: string;
  groupName: string;
  sessions: StudentSessionView[];
  teacherReturnPinConfigured?: boolean;
  assessmentRound?: {
    roundId: string;
    roundName: string;
    status: string;
    selectedEventsByFactor: Record<string, string>;
    factors: Array<{ factorId: string; eventId: string; complete: boolean }>;
  };
}

export interface SetSyncStatusInput extends RecordSelector {
  status: PAPSSyncStatusRecord["status"];
  updatedAt: string;
  attemptId?: string | null;
  message?: string;
}

export interface PapsStore {
  getTeacherBootstrap(input: TeacherSummaryInput): Promise<TeacherBootstrap>;
  rebuildSummaries(input: TeacherSummaryInput): Promise<TeacherBootstrap>;
  getClass(classId: string): PAPSClassroom;
  saveClass(classroom: PAPSClassroom): PAPSClassroom;
  deleteClass(classId: string): void;
  getStudent(studentId: string): PAPSStudent;
  saveStudent(student: PAPSStudent): PAPSStudent;
  deleteStudent(studentId: string): void;
  getSession(sessionId: string): PAPSSession;
  saveSession(session: PAPSSession): PAPSSession;
  saveSessions(sessions: PAPSSession[]): PAPSSession[];
  deleteSession(sessionId: string): void;
  appendAttempt(input: AppendAttemptInput): PAPSAttemptRecord;
  updateAttempt(input: UpdateAttemptInput): PAPSAttemptRecord;
  listSessionRecords(sessionId: string): PAPSAttemptRecord[];
  listStudentEventHistory(input: RecordSelector): PAPSStudentEventHistoryAttempt[];
  getStudentSessionView(sessionId: string): Promise<StudentSessionView>;
  getStudentSessionGroupView(sessionGroupId: string): Promise<StudentSessionGroupView>;
  selectRepresentativeAttempt(input: SelectRepresentativeAttemptInput): PAPSAttemptRecord;
  getSyncStatus(selector: RecordSelector): PAPSSyncStatusRecord | null;
  setSyncStatus(input: SetSyncStatusInput): PAPSSyncStatusRecord;
  /** Four-factor assessment-round operations are present on the runtime store. */
  createAssessmentRound?: AssessmentRoundMemoryStore["createAssessmentRound"];
  getAssessmentRound?: AssessmentRoundMemoryStore["getAssessmentRound"];
  listAssessmentRounds?: AssessmentRoundMemoryStore["listAssessmentRounds"];
  saveAssessmentRound?: AssessmentRoundMemoryStore["saveAssessmentRound"];
  listStudentRoundResults?: AssessmentRoundMemoryStore["listStudentRoundResults"];
  getStudentRoundResult?: AssessmentRoundMemoryStore["getStudentRoundResult"];
  previewAssessmentRound?: AssessmentRoundMemoryStore["previewAssessmentRound"];
  saveStudentRoundResult?: AssessmentRoundMemoryStore["saveStudentRoundResult"];
  finalizeStudentRound?: AssessmentRoundMemoryStore["finalizeStudentRound"];
  excludeStudentRound?: AssessmentRoundMemoryStore["excludeStudentRound"];
  updateAssessmentRoundStatus?: AssessmentRoundMemoryStore["updateAssessmentRoundStatus"];
}

export interface SchoolStore {
  getTeacherBootstrap(input: TeacherSummaryInput): Promise<TeacherBootstrap>;
  saveSchool(school: PAPSSchool): PAPSSchool;
  deleteSchool(schoolId: string): void;
}
