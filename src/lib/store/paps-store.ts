import { getDemoStore } from "../demo-store";
import type { PAPSStoredAttempt } from "../paps/types";
import type { PapsStore, TeacherBootstrap } from "./paps-store-types";

const toPapsStoredAttempt = (
  record: {
    sessionId: string;
    studentId: string;
    eventId: PAPSStoredAttempt["eventId"];
    unit: PAPSStoredAttempt["unit"];
    attempts: Array<{
      id: string;
      attemptNumber: number;
      measurement: number;
      createdAt: string;
    }>;
  }
): PAPSStoredAttempt[] =>
  record.attempts.map((attempt) => ({
    id: attempt.id,
    sessionId: record.sessionId,
    studentId: record.studentId,
    eventId: record.eventId,
    unit: record.unit,
    attemptNumber: attempt.attemptNumber,
    measurement: attempt.measurement,
    createdAt: attempt.createdAt
  }));

const buildTeacherBootstrap = (store: ReturnType<typeof getDemoStore>, teacherEmail: string): TeacherBootstrap => {
  const teacher = store.getTeacherByEmail(teacherEmail);
  const schoolId = teacher?.schoolId ?? null;
  const schools = schoolId ? store.listSchools().filter((entry) => entry.id === schoolId) : store.listSchools();
  const school = schoolId ? store.getSchool(schoolId) : null;
  const classes = schoolId
    ? store.listClasses().filter((entry) => entry.schoolId === schoolId)
    : store.listClasses();
  const teachers = schoolId
    ? store.listTeachers().filter((entry) => entry.schoolId === schoolId)
    : store.listTeachers();
  const students = schoolId
    ? store.listStudents().filter((entry) => entry.schoolId === schoolId)
    : store.listStudents();
  const sessions = schoolId
    ? store.listSessions().filter((entry) => entry.schoolId === schoolId)
    : store.listSessions();
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const attempts = sessions.flatMap((session) => toPapsStoredAttempt(store.listSessionRecords(session.id)));

  return {
    teacher,
    school,
    schools,
    classes,
    teachers,
    students,
    sessions,
    attempts,
    syncStatuses: store.listSyncStatuses().filter((entry) => sessionIds.has(entry.sessionId)),
    syncErrorLogs: store.listSyncErrorLogs().filter((entry) => sessionIds.has(entry.sessionId)),
    representativeSelectionAuditLogs: store
      .listRepresentativeSelectionAuditLogs()
      .filter((entry) => sessionIds.has(entry.sessionId))
  };
};

export const createStoreForRequest = async (): Promise<PapsStore> => {
  const demoStore = getDemoStore();
  const { filePath: _filePath, ...store } = demoStore;

  return {
    ...store,
    getTeacherBootstrap: async ({ teacherEmail }) => buildTeacherBootstrap(demoStore, teacherEmail)
  };
};
