import type { TeacherBootstrap } from "../store/paps-store-types";
import {
  classifyTeacherSheetStatus,
  createConnectedTeacherSheetStatus,
  type TeacherSheetStatus
} from "./sheet-connection-status";

const detectTestEnvironment = (): boolean => process.env.NODE_ENV === "test";

export const getDisconnectedTeacherBootstrap = (): TeacherBootstrap => ({
  teacher: null,
  school: null,
  schools: [],
  classes: [],
  teachers: [],
  students: [],
  sessions: [],
  attempts: [],
  syncStatuses: [],
  syncErrorLogs: [],
  representativeSelectionAuditLogs: []
});

export const resolveStoreWithSpreadsheetId = async <TTestStore, TConnectedStore>({
  spreadsheetId,
  teacherEmail,
  testStoreFactory,
  connectedStoreFactory,
  isTestEnvironment = detectTestEnvironment()
}: {
  spreadsheetId: string | null | undefined;
  teacherEmail: string;
  testStoreFactory: () => Promise<TTestStore>;
  connectedStoreFactory: (input: {
    spreadsheetId: string;
    teacherEmail: string;
  }) => Promise<TConnectedStore>;
  isTestEnvironment?: boolean;
}): Promise<TTestStore | TConnectedStore> => {
  if (isTestEnvironment) {
    return testStoreFactory();
  }

  if (!spreadsheetId) {
    throw new Error("Google Sheets is not connected.");
  }

  return connectedStoreFactory({
    spreadsheetId,
    teacherEmail
  });
};

type TeacherBootstrapStore = {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
};

export const loadTeacherPageStateWithResolvers = async <
  TTestStore extends TeacherBootstrapStore,
  TConnectedStore extends TeacherBootstrapStore
>({
  teacherEmail,
  spreadsheetId,
  createTestStore,
  createConnectedStore,
  disconnectedBootstrap = getDisconnectedTeacherBootstrap,
  isTestEnvironment = detectTestEnvironment()
}: {
  teacherEmail: string;
  spreadsheetId: string | null | undefined;
  createTestStore: () => Promise<TTestStore>;
  createConnectedStore: (input: {
    spreadsheetId: string;
    teacherEmail: string;
  }) => Promise<TConnectedStore>;
  disconnectedBootstrap?: () => TeacherBootstrap;
  isTestEnvironment?: boolean;
}): Promise<{
  store: TTestStore | TConnectedStore | null;
  bootstrap: TeacherBootstrap;
  sheetConnected: boolean;
  sheetStatus: TeacherSheetStatus;
}> => {
  if (isTestEnvironment) {
    const store = await createTestStore();
    const sheetStatus = createConnectedTeacherSheetStatus();

    return {
      store,
      bootstrap: await store.getTeacherBootstrap({ teacherEmail }),
      sheetConnected: sheetStatus.isConnected,
      sheetStatus
    };
  }

  if (!spreadsheetId) {
    const sheetStatus = classifyTeacherSheetStatus({ spreadsheetId });

    return {
      store: null,
      bootstrap: disconnectedBootstrap(),
      sheetConnected: sheetStatus.isConnected,
      sheetStatus
    };
  }

  try {
    const store = await createConnectedStore({
      spreadsheetId,
      teacherEmail
    });
    const bootstrap = await store.getTeacherBootstrap({ teacherEmail });

    if (!bootstrap.teacher) {
      const sheetStatus = classifyTeacherSheetStatus({
        spreadsheetId,
        teacherAuthorized: false
      });

      return {
        store: null,
        bootstrap: disconnectedBootstrap(),
        sheetConnected: sheetStatus.isConnected,
        sheetStatus
      };
    }

    const sheetStatus = createConnectedTeacherSheetStatus();

    return {
      store,
      bootstrap,
      sheetConnected: sheetStatus.isConnected,
      sheetStatus
    };
  } catch (error) {
    const sheetStatus = classifyTeacherSheetStatus({
      spreadsheetId,
      error
    });

    return {
      store: null,
      bootstrap: disconnectedBootstrap(),
      sheetConnected: sheetStatus.isConnected,
      sheetStatus
    };
  }
};
