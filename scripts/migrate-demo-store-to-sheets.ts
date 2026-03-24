import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createPapsGoogleSheetTabPayloads, prepareGoogleSheetTabWrite } from "../src/lib/google/sheets";
import { createGoogleSheetClientFromEnv } from "../src/lib/google/sheets-store";
import type { PAPSStoredAttempt } from "../src/lib/paps/types";
import { createPapsMemoryStore, validatePapsStoreData } from "../src/lib/store/paps-memory-store";

const DEFAULT_LEGACY_PATH = ".data/paps/demo-store.json";

type ParsedArgs = {
  inputPath: string | null;
  spreadsheetId: string | null;
  schoolId: string | null;
  write: boolean;
};

const parseArgs = (argv: string[]): ParsedArgs => {
  const parsed: ParsedArgs = {
    inputPath: null,
    spreadsheetId: null,
    schoolId: null,
    write: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--input") {
      parsed.inputPath = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === "--sheet") {
      parsed.spreadsheetId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === "--school") {
      parsed.schoolId = argv[index + 1] ?? null;
      index += 1;
      continue;
    }

    if (token === "--write") {
      parsed.write = true;
    }
  }

  return parsed;
};

const toStoredAttempts = (
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
      clientSubmissionKey?: string;
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
      createdAt: attempt.createdAt,
      clientSubmissionKey: attempt.clientSubmissionKey
    }))
  );

const resolveLegacyPath = (inputPath: string | null): string => {
  if (inputPath) {
    return resolve(inputPath);
  }

  const defaultPath = resolve(DEFAULT_LEGACY_PATH);

  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  throw new Error("Legacy demo-store path was not found. Use --input <path>.");
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));

  if (!args.spreadsheetId) {
    throw new Error("Use --sheet <spreadsheetId> to choose the target spreadsheet.");
  }

  const legacyPath = resolveLegacyPath(args.inputPath);
  const store = createPapsMemoryStore(
    validatePapsStoreData(JSON.parse(readFileSync(legacyPath, "utf8")) as unknown)
  );
  const schools = store.listSchools();
  const school =
    (args.schoolId
      ? schools.find((entry) => entry.id === args.schoolId)
      : schools.length === 1
        ? schools[0]
        : null) ?? null;

  if (!school) {
    throw new Error("Could not resolve a single school. Use --school <schoolId>.");
  }

  const classes = store.listClasses().filter((entry) => entry.schoolId === school.id);
  const classIds = new Set(classes.map((entry) => entry.id));
  const teachers = store.listTeachers().filter((entry) => entry.schoolId === school.id);
  const students = store
    .listStudents()
    .filter((entry) => entry.schoolId === school.id || classIds.has(entry.classId));
  const sessions = store.listSessions().filter((entry) => entry.schoolId === school.id);
  const sessionIds = new Set(sessions.map((entry) => entry.id));
  const attempts = toStoredAttempts(
    sessions.flatMap((session) => store.listSessionRecords(session.id))
  );
  const syncStatuses = store.listSyncStatuses().filter((entry) => sessionIds.has(entry.sessionId));
  const syncErrorLogs = store.listSyncErrorLogs().filter((entry) => sessionIds.has(entry.sessionId));
  const representativeSelectionAuditLogs = store
    .listRepresentativeSelectionAuditLogs()
    .filter((entry) => sessionIds.has(entry.sessionId));
  const tabs = createPapsGoogleSheetTabPayloads({
    school,
    classes,
    teachers,
    students,
    sessions,
    attempts,
    syncStatuses,
    syncErrorLogs,
    representativeSelectionAuditLogs
  });

  console.log(
    JSON.stringify(
      {
        input: legacyPath,
        spreadsheetId: args.spreadsheetId,
        schoolId: school.id,
        tabSummaries: tabs.map((tab) => ({
          tabName: tab.tabName,
          rows: tab.rows.length,
          columns: tab.header.length
        })),
        mode: args.write ? "write" : "dry-run"
      },
      null,
      2
    )
  );

  if (!args.write) {
    return;
  }

  const client = createGoogleSheetClientFromEnv();

  for (const tab of tabs) {
    const request = prepareGoogleSheetTabWrite(tab);
    await client.updateRange(args.spreadsheetId, request.range, request.values);
  }

  console.log(`Migrated ${tabs.length} tabs to spreadsheet ${args.spreadsheetId}.`);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
});
