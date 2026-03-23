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
  PAPSStudent
} from "../paps/types";

export interface AppendAttemptInput {
  id: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
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
}

export interface StudentSessionClassSection {
  classId: string;
  label: string;
  students: Array<Pick<PAPSStudent, "id" | "name">>;
}

export interface StudentSessionView {
  session: PAPSSession;
  classSections: StudentSessionClassSection[];
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
  deleteSession(sessionId: string): void;
  appendAttempt(input: AppendAttemptInput): PAPSAttemptRecord;
  listSessionRecords(sessionId: string): PAPSAttemptRecord[];
  getStudentSessionView(sessionId: string): Promise<StudentSessionView>;
  selectRepresentativeAttempt(input: SelectRepresentativeAttemptInput): PAPSAttemptRecord;
  getSyncStatus(selector: RecordSelector): PAPSSyncStatusRecord | null;
  setSyncStatus(input: SetSyncStatusInput): PAPSSyncStatusRecord;
}

export interface SchoolStore {
  getTeacherBootstrap(input: TeacherSummaryInput): Promise<TeacherBootstrap>;
  saveSchool(school: PAPSSchool): PAPSSchool;
  deleteSchool(schoolId: string): void;
}
