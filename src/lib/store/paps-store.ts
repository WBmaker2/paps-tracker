import { getDemoStore } from "../demo-store";
import type { PAPSStoredAttempt } from "../paps/types";
import type {
  PapsStore,
  SchoolStore,
  StudentSessionView,
  TeacherBootstrap,
  TeacherSummaryInput
} from "./paps-store-types";

const toPapsStoredAttempts = (
  records: Array<{
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
  }>
): PAPSStoredAttempt[] =>
  records.flatMap((record) =>
    record.attempts.map((attempt) => ({
      id: attempt.id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      eventId: record.eventId,
      unit: record.unit,
      attemptNumber: attempt.attemptNumber,
      measurement: attempt.measurement,
      createdAt: attempt.createdAt
    }))
  );

const buildTeacherBootstrap = (
  store: ReturnType<typeof getDemoStore>,
  teacherEmail: string
): TeacherBootstrap => {
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
  const students = schoolId ? store.listStudents().filter((entry) => entry.schoolId === schoolId) : store.listStudents();
  const sessions = schoolId
    ? store.listSessions().filter((entry) => entry.schoolId === schoolId)
    : store.listSessions();
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const attempts = sessions.flatMap((session) => toPapsStoredAttempts(store.listSessionRecords(session.id)));

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

const buildStudentSessionView = (
  store: ReturnType<typeof getDemoStore>,
  sessionId: string
): StudentSessionView => {
  const session = store.getSession(sessionId);
  const activeStudents = store.listStudents().filter((student) => student.active !== false);
  const classSections = session.classTargets.map((classTarget) => {
    const classroom = store.getClass(classTarget.classId);

    return {
      classId: classroom.id,
      label: classroom.label,
      students: activeStudents
        .filter((student) => student.classId === classroom.id)
        .sort((left, right) => {
          if (left.studentNumber !== undefined && right.studentNumber !== undefined) {
            return left.studentNumber - right.studentNumber;
          }

          return left.name.localeCompare(right.name, "en");
        })
        .map((student) => ({
          id: student.id,
          name: student.name
        }))
    };
  });

  return {
    session,
    classSections
  };
};

export const createStoreForRequest = async (): Promise<PapsStore> => {
  const demoStore = getDemoStore();
  const getTeacherBootstrap = async ({ teacherEmail }: TeacherSummaryInput) =>
    buildTeacherBootstrap(demoStore, teacherEmail);
  const getStudentSessionView = async (sessionId: string) =>
    buildStudentSessionView(demoStore, sessionId);

  return {
    getTeacherBootstrap,
    rebuildSummaries: getTeacherBootstrap,
    getClass: demoStore.getClass,
    saveClass: demoStore.saveClass,
    deleteClass: demoStore.deleteClass,
    getStudent: demoStore.getStudent,
    saveStudent: demoStore.saveStudent,
    deleteStudent: demoStore.deleteStudent,
    getSession: demoStore.getSession,
    saveSession: demoStore.saveSession,
    deleteSession: demoStore.deleteSession,
    appendAttempt: demoStore.appendAttempt,
    listSessionRecords: demoStore.listSessionRecords,
    getStudentSessionView,
    selectRepresentativeAttempt: demoStore.selectRepresentativeAttempt,
    getSyncStatus: demoStore.getSyncStatus,
    setSyncStatus: demoStore.setSyncStatus
  };
};

export const createSchoolStoreForRequest = async (): Promise<SchoolStore> => {
  const demoStore = getDemoStore();
  const getTeacherBootstrap = async ({ teacherEmail }: TeacherSummaryInput) =>
    buildTeacherBootstrap(demoStore, teacherEmail);

  return {
    getTeacherBootstrap,
    saveSchool: demoStore.saveSchool,
    deleteSchool: demoStore.deleteSchool
  };
};
