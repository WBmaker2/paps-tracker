import type { PAPSSyncState, PAPSStoredAttempt } from "../paps/types";

export interface AppendAttemptInput {
  id: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  createdAt: string;
  clientSubmissionKey?: string | null;
  detail?: PAPSStoredAttempt["detail"];
}
export interface UpdateAttemptInput {
  attemptId: string;
  sessionId: string;
  studentId: string;
  measurement: number;
  clientSubmissionKey?: string | null;
  detail?: PAPSStoredAttempt["detail"];
}
export interface RecordSelector { sessionId: string; studentId: string; }
export interface SelectRepresentativeAttemptInput extends RecordSelector {
  attemptId: string | null;
  changedByTeacherId: string;
  createdAt: string;
  reason?: string;
}
export interface SetSyncStatusInput extends RecordSelector {
  status: PAPSSyncState;
  updatedAt: string;
  message?: string;
  attemptId?: string | null;
}
