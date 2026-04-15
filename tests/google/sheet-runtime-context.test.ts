import { describe, expect, it, vi } from "vitest";

import {
  getDisconnectedTeacherBootstrap,
  loadTeacherPageStateWithResolvers,
  resolveStoreWithSpreadsheetId
} from "../../src/lib/google/sheet-runtime-context";

describe("Google Sheet runtime context helpers", () => {
  it("returns the test store when runtime resolution runs in test mode", async () => {
    const testStore = { kind: "test-store" };

    await expect(
      resolveStoreWithSpreadsheetId({
        spreadsheetId: null,
        teacherEmail: "teacher@example.com",
        isTestEnvironment: true,
        testStoreFactory: async () => testStore,
        connectedStoreFactory: async () => ({ kind: "sheet-store" })
      })
    ).resolves.toBe(testStore);
  });

  it("returns a disconnected bootstrap when no spreadsheet is connected", async () => {
    const result = await loadTeacherPageStateWithResolvers({
      teacherEmail: "teacher@example.com",
      spreadsheetId: null,
      isTestEnvironment: false,
      createTestStore: async () => {
        throw new Error("should not be called");
      },
      createConnectedStore: async () => {
        throw new Error("should not be called");
      }
    });

    expect(result.store).toBeNull();
    expect(result.bootstrap).toEqual(getDisconnectedTeacherBootstrap());
    expect(result.sheetStatus.code).toBe("not_connected");
  });

  it("marks the sheet unauthorized when bootstrap has no matching teacher", async () => {
    const getTeacherBootstrap = vi.fn(async () => ({
      ...getDisconnectedTeacherBootstrap(),
      school: {
        id: "school-1",
        name: "Demo School",
        teacherIds: [],
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      }
    }));

    const result = await loadTeacherPageStateWithResolvers({
      teacherEmail: "teacher@example.com",
      spreadsheetId: "sheet-123",
      isTestEnvironment: false,
      createTestStore: async () => {
        throw new Error("should not be called");
      },
      createConnectedStore: async () => ({
        getTeacherBootstrap
      })
    });

    expect(result.store).toBeNull();
    expect(result.bootstrap).toEqual(getDisconnectedTeacherBootstrap());
    expect(result.sheetStatus.code).toBe("teacher_not_authorized");
  });

  it("returns a classified load failure when connected store creation throws", async () => {
    const result = await loadTeacherPageStateWithResolvers({
      teacherEmail: "teacher@example.com",
      spreadsheetId: "sheet-123",
      isTestEnvironment: false,
      createTestStore: async () => {
        throw new Error("should not be called");
      },
      createConnectedStore: async () => {
        throw new Error("boom");
      }
    });

    expect(result.store).toBeNull();
    expect(result.sheetStatus.code).toBe("load_failed");
    expect(result.sheetStatus.detail).toBe("boom");
  });
});
