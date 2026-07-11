import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  writeGoogleSheetSettingsSourceTab,
  validatePapsGoogleSheetTemplate,
  buildStructuredStateFromSheet
} = vi.hoisted(() => ({
  writeGoogleSheetSettingsSourceTab: vi.fn(async () => undefined),
  validatePapsGoogleSheetTemplate: vi.fn(async () => undefined),
  buildStructuredStateFromSheet: vi.fn(async () => {
    throw new Error("state mock not configured");
  })
}));

vi.mock("../../src/lib/google/sheet-source-write", () => ({
  writeGoogleSheetSettingsSourceTab
}));

vi.mock("../../src/lib/google/sheets-schema", () => ({
  validatePapsGoogleSheetTemplate
}));

vi.mock("../../src/lib/google/sheets-bootstrap", () => ({
  buildStructuredStateFromSheet
}));

import { connectGoogleSheetForTeacher } from "../../src/lib/google/sheet-connect";
import { createTeacherSheetInviteToken } from "../../src/lib/google/teacher-sheet-invite";

describe("Google Sheet connection persistence", () => {
  beforeEach(() => {
    writeGoogleSheetSettingsSourceTab.mockClear();
    validatePapsGoogleSheetTemplate.mockClear();
    buildStructuredStateFromSheet.mockReset();
  });

  it("adds the current teacher to an unpersisted sheet and writes updated settings", async () => {
    buildStructuredStateFromSheet.mockResolvedValueOnce({
      school: {
        id: "school-1",
        name: "Alpha Elementary",
        teacherIds: [],
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      },
      classes: [],
      teachers: [],
      hasPersistedTeachers: false,
      sessions: [],
      allStudents: [],
      attempts: [],
      syncStatuses: [],
      syncErrorLogs: [],
      representativeSelectionAuditLogs: []
    });

    const result = await connectGoogleSheetForTeacher({
      client: {} as never,
      spreadsheetId: "sheet-123",
      normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      teacherEmail: "teacher@example.com",
      teacherName: "Teacher Kim",
      schoolName: "Renamed School"
    });

    expect(validatePapsGoogleSheetTemplate).toHaveBeenCalledWith(expect.anything(), "sheet-123");
    expect(result.school).toMatchObject({
      name: "Renamed School",
      teacherIds: ["teacher-teacher-example-com"],
      sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit"
    });
    const writeState = writeGoogleSheetSettingsSourceTab.mock.calls[0]?.[0]?.state;
    expect(writeState.teachers[0]).toMatchObject({
      email: "teacher@example.com",
      name: "Teacher Kim"
    });
  });

  it("rejects a persisted sheet when the current teacher is not authorized", async () => {
    buildStructuredStateFromSheet.mockResolvedValueOnce({
      school: {
        id: "school-1",
        name: "Alpha Elementary",
        teacherIds: ["teacher-1"],
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      },
      classes: [],
      teachers: [
        {
          id: "teacher-1",
          schoolId: "school-1",
          name: "Another Teacher",
          email: "another@example.com",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      hasPersistedTeachers: true,
      sessions: [],
      allStudents: [],
      attempts: [],
      syncStatuses: [],
      syncErrorLogs: [],
      representativeSelectionAuditLogs: []
    });

    await expect(
      connectGoogleSheetForTeacher({
        client: {} as never,
        spreadsheetId: "sheet-123",
        normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        teacherEmail: "teacher@example.com"
      })
    ).rejects.toThrow("The current teacher is not authorized for this spreadsheet.");
  });

  it("adds a teacher to a persisted sheet only with a matching invitation", async () => {
    buildStructuredStateFromSheet.mockResolvedValueOnce({
      school: {
        id: "school-1",
        name: "Alpha Elementary",
        teacherIds: ["teacher-1"],
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      },
      classes: [],
      teachers: [
        {
          id: "teacher-1",
          schoolId: "school-1",
          name: "Another Teacher",
          email: "another@example.com",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      hasPersistedTeachers: true,
      sessions: [],
      allStudents: [],
      attempts: [],
      syncStatuses: [],
      syncErrorLogs: [],
      representativeSelectionAuditLogs: []
    });
    const teacherInviteToken = createTeacherSheetInviteToken({
      spreadsheetId: "sheet-123",
      inviterEmail: "another@example.com",
      targetEmail: "teacher@example.com",
      now: new Date("2026-07-12T00:00:00.000Z")
    });

    const result = await connectGoogleSheetForTeacher({
      client: {} as never,
      spreadsheetId: "sheet-123",
      normalizedUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      teacherEmail: "teacher@example.com",
      teacherName: "Teacher Kim",
      teacherInviteToken,
      now: new Date("2026-07-12T00:05:00.000Z")
    });

    expect(result.school.teacherIds).toContain("teacher-teacher-example-com");
    expect(writeGoogleSheetSettingsSourceTab).toHaveBeenCalledTimes(1);
  });
});
