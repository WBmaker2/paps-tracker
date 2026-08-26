import type {
  PAPSAttemptRecord,
  PAPSClassroom,
  PAPSSchool,
  PAPSSession,
  PAPSSyncStatusRecord,
  PAPSStudent,
  PAPSAssessmentRound,
  PAPSStudentRoundResult
} from "../paps/types";
import type { AssessmentRoundMemoryStore } from "../store/paps-memory-round-store";
import { createSchoolStoreForRequest, createStoreForRequest } from "../store/paps-store";
import type {
  RecordSelector,
  SelectRepresentativeAttemptInput,
  SetSyncStatusInput,
  StudentSessionGroupView,
  StudentSessionView,
  TeacherBootstrap
} from "../store/paps-store-types";
import type { GoogleSheetsClient } from "./sheets-client";

type MaybePromise<T> = T | Promise<T>;

export interface TeacherSheetsStore {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
  getClass(classId: string): MaybePromise<PAPSClassroom>;
  saveClass(classroom: PAPSClassroom): Promise<PAPSClassroom>;
  deleteClass(classId: string): Promise<void>;
  getStudent(studentId: string): MaybePromise<PAPSStudent>;
  saveStudent(student: PAPSStudent): Promise<PAPSStudent>;
  deleteStudent(studentId: string): Promise<void>;
  getSession(sessionId: string): MaybePromise<PAPSSession>;
  saveSession(session: PAPSSession): Promise<PAPSSession>;
  saveSessions(sessions: PAPSSession[]): Promise<PAPSSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  getStudentSessionView(sessionId: string): Promise<StudentSessionView>;
  getStudentSessionGroupView(sessionGroupId: string): Promise<StudentSessionGroupView>;
  listSessionRecords(sessionId: string): MaybePromise<PAPSAttemptRecord[]>;
  selectRepresentativeAttempt(
    input: SelectRepresentativeAttemptInput
  ): MaybePromise<PAPSAttemptRecord>;
  getSyncStatus(selector: RecordSelector): MaybePromise<PAPSSyncStatusRecord | null>;
  setSyncStatus(input: SetSyncStatusInput): MaybePromise<PAPSSyncStatusRecord>;
  saveSchool(school: PAPSSchool): Promise<PAPSSchool>;
  createAssessmentRound?: (input: Parameters<AssessmentRoundMemoryStore["createAssessmentRound"]>[0]) => Promise<ReturnType<AssessmentRoundMemoryStore["createAssessmentRound"]>>;
  getAssessmentRound?: (roundId: string) => Promise<PAPSAssessmentRound>;
  listAssessmentRounds?: () => Promise<PAPSAssessmentRound[]>;
  listStudentRoundResults?: (roundId: string) => Promise<PAPSStudentRoundResult[]>;
  getStudentRoundResult?: (input: { roundId: string; studentId: string }) => Promise<PAPSStudentRoundResult | null>;
  previewAssessmentRound?: (input: Parameters<AssessmentRoundMemoryStore["previewAssessmentRound"]>[0]) => Promise<PAPSStudentRoundResult[]>;
  finalizeStudentRound?: (input: Parameters<AssessmentRoundMemoryStore["finalizeStudentRound"]>[0]) => Promise<ReturnType<AssessmentRoundMemoryStore["finalizeStudentRound"]>>;
  excludeStudentRound?: (input: Parameters<AssessmentRoundMemoryStore["excludeStudentRound"]>[0]) => Promise<ReturnType<AssessmentRoundMemoryStore["excludeStudentRound"]>>;
}

export type TeacherCrudStore = Awaited<ReturnType<typeof createStoreForRequest>> | TeacherSheetsStore;
export type TeacherSchoolStore =
  | Awaited<ReturnType<typeof createSchoolStoreForRequest>>
  | TeacherSheetsStore;

export interface CreateGoogleSheetsStoreForRequestInput {
  spreadsheetId: string;
  teacherEmail: string;
  client?: GoogleSheetsClient;
}
