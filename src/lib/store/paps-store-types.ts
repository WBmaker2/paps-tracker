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
import type {
  AppendAttemptInput,
  RecordSelector,
  SelectRepresentativeAttemptInput,
  SetSyncStatusInput
} from "../demo-store";

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

export interface PapsStore {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
  listSchools(): PAPSSchool[];
  saveSchool(school: PAPSSchool): PAPSSchool;
  deleteSchool(schoolId: string): void;
  listClasses(): PAPSClassroom[];
  saveClass(classroom: PAPSClassroom): PAPSClassroom;
  deleteClass(classId: string): void;
  listTeachers(): PAPSTeacher[];
  getTeacher(teacherId: string): PAPSTeacher;
  getTeacherByEmail(email: string): PAPSTeacher | null;
  listStudents(): PAPSStudent[];
  saveStudent(student: PAPSStudent): PAPSStudent;
  deleteStudent(studentId: string): void;
  listSessions(): PAPSSession[];
  saveSession(session: PAPSSession): PAPSSession;
  deleteSession(sessionId: string): void;
  getSession(sessionId: string): PAPSSession;
  getSchool(schoolId: string): PAPSSchool;
  getClass(classId: string): PAPSClassroom;
  getStudent(studentId: string): PAPSStudent;
  appendAttempt(input: AppendAttemptInput): PAPSAttemptRecord;
  getAttemptRecord(selector: RecordSelector): PAPSAttemptRecord;
  listSessionRecords(sessionId: string): PAPSAttemptRecord[];
  selectRepresentativeAttempt(input: SelectRepresentativeAttemptInput): PAPSAttemptRecord;
  setSyncStatus(input: SetSyncStatusInput): PAPSSyncStatusRecord;
  getSyncStatus(selector: RecordSelector): PAPSSyncStatusRecord | null;
  listSyncStatuses(): PAPSSyncStatusRecord[];
  listSyncErrorLogs(selector?: RecordSelector): PAPSSyncErrorLog[];
  listRepresentativeSelectionAuditLogs(
    selector?: RecordSelector
  ): PAPSRepresentativeSelectionAuditLog[];
}
