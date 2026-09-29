import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { normalizeGoogleServiceAccountPrivateKey } from "../src/lib/env";
import {
  buildSessionRowRecoveryRows,
  SESSION_ROW_LABELS,
  SESSION_ROW_RECOVERY_CLASS_IDS,
  SESSION_ROW_RECOVERY_GROUP_ID,
  SESSION_ROW_RECOVERY_IDS,
  type SessionRecoveryManifestEntry
} from "../src/lib/google/session-row-recovery";
import { createGoogleSheetsClient } from "../src/lib/google/sheets-client";

const args = process.argv.slice(2);
const arg = (name: string) => args.find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1);
const ALLOWED_SPREADSHEET_ID = "1zOhvYPyJEtiM3s5i3-tsYOqUA0AX8S2EJBW0dsqSYNQ";
const spreadsheetId = arg("--spreadsheet-id");
const manifestPath = arg("--manifest");
const apply = args.includes("--apply");

const buildManifestTemplate = (settings: string[][]): unknown => {
  const groupItems = settings.filter((row) => row[0] === SESSION_ROW_LABELS.groupItem && row[1] === SESSION_ROW_RECOVERY_GROUP_ID);
  const siblingItem = groupItems.find((row) => !SESSION_ROW_RECOVERY_IDS.includes(row[2] as typeof SESSION_ROW_RECOVERY_IDS[number]));
  const siblingId = siblingItem?.[2] ?? "";
  const session = settings.find((row) => row[0] === SESSION_ROW_LABELS.session && row[1] === siblingId);
  const meta = settings.find((row) => row[0] === SESSION_ROW_LABELS.meta && row[1] === siblingId);
  const status = settings.find((row) => row[0] === SESSION_ROW_LABELS.status && row[1] === siblingId);
  if (!siblingItem || !session || !meta || !status) return { error: "온전한 같은 묶음의 세션 1개를 찾지 못했습니다." };
  return SESSION_ROW_RECOVERY_IDS.map((id) => {
    const item = groupItems.find((row) => row[2] === id);
    const eventId = item?.[4] ?? "";
    return {
      id,
      name: "교사가 확인해 입력할 세션명",
      schoolId: session[2],
      teacherId: session[3],
      academicYear: Number(session[4]),
      gradeLevel: Number(meta[2]),
      sessionType: meta[3],
      classScope: meta[4],
      eventId,
      sessionGroupOrder: Number(item?.[3]),
      createdAt: status[3],
      classTargets: SESSION_ROW_RECOVERY_CLASS_IDS.map((classId) => ({ classId, eventId }))
    };
  });
};

const main = async () => {
  if (!spreadsheetId) throw new Error("--spreadsheet-id is required.");
  if (spreadsheetId !== ALLOWED_SPREADSHEET_ID) throw new Error("This recovery tool is restricted to its observed spreadsheet ID.");
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizeGoogleServiceAccountPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
  if (!email || !privateKey) throw new Error("Google service account credentials are missing or invalid in this environment.");
  const client = createGoogleSheetsClient({ serviceAccountEmail: email, serviceAccountPrivateKey: privateKey });
  const metadata = await client.getSpreadsheet(spreadsheetId);
  if (metadata.spreadsheetId !== ALLOWED_SPREADSHEET_ID) throw new Error("Spreadsheet ID confirmation failed; refusing to continue.");
  const [settings, records] = await Promise.all([
    client.readRange(spreadsheetId, "'설정'!A:F"),
    client.readRange(spreadsheetId, "'세션기록'!A:U")
  ]);
  const linkedRecords = records.filter((row) => SESSION_ROW_RECOVERY_IDS.includes(row[1] as typeof SESSION_ROW_RECOVERY_IDS[number]));
  const present = (label: string, id: string) => settings.filter((row) => row[0] === label && row[1] === id).length;
  const proposedRows = [
    [SESSION_ROW_LABELS.status, SESSION_ROW_RECOVERY_IDS[0]],
    [SESSION_ROW_LABELS.target, SESSION_ROW_RECOVERY_IDS[0]],
    [SESSION_ROW_LABELS.target, SESSION_ROW_RECOVERY_IDS[0]],
    [SESSION_ROW_LABELS.session, SESSION_ROW_RECOVERY_IDS[1]],
    [SESSION_ROW_LABELS.meta, SESSION_ROW_RECOVERY_IDS[1]],
    [SESSION_ROW_LABELS.status, SESSION_ROW_RECOVERY_IDS[1]],
    [SESSION_ROW_LABELS.target, SESSION_ROW_RECOVERY_IDS[1]],
    [SESSION_ROW_LABELS.target, SESSION_ROW_RECOVERY_IDS[1]]
  ];
  const report = {
    spreadsheetId,
    groupId: SESSION_ROW_RECOVERY_GROUP_ID,
    groupItemCount: settings.filter((row) => row[0] === SESSION_ROW_LABELS.groupItem && row[1] === SESSION_ROW_RECOVERY_GROUP_ID).length,
    targetRows: Object.fromEntries(SESSION_ROW_RECOVERY_IDS.map((id) => [id, {
      session: present(SESSION_ROW_LABELS.session, id),
      meta: present(SESSION_ROW_LABELS.meta, id),
      status: present(SESSION_ROW_LABELS.status, id),
      targets: present(SESSION_ROW_LABELS.target, id)
    }])),
    linkedMeasurementRecords: linkedRecords.length,
    proposedMissingRows: proposedRows,
    manifestPreparation: {
    command: `npx tsx scripts/recover-september-session-rows.ts --spreadsheet-id=${spreadsheetId} --manifest=/absolute/path/recovery-manifest.json`,
      template: buildManifestTemplate(settings),
      instruction: "두 세션의 이름만 실제 표시명으로 확인해 채우고, 나머지 필드가 교사 원본 정보와 일치하는지 검토합니다. Apply에는 --apply, --confirm-group=<묶음 ID>, --confirm-spreadsheet=<허용된 시트 ID>를 모두 지정해야 합니다."
    },
    mode: apply ? "apply" : "preview"
  };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (arg("--confirm-group") !== SESSION_ROW_RECOVERY_GROUP_ID) throw new Error("Apply mode requires --confirm-group with the exact target group ID.");
  if (arg("--confirm-spreadsheet") !== ALLOWED_SPREADSHEET_ID) throw new Error("Apply mode requires --confirm-spreadsheet with the exact allowlisted spreadsheet ID.");
  if (!manifestPath) throw new Error("Apply mode requires a reviewed --manifest JSON file.");
  if (linkedRecords.length) throw new Error("Measurement records exist for the target sessions; refusing to modify settings.");
  const manifest = JSON.parse(await readFile(resolve(manifestPath), "utf8")) as SessionRecoveryManifestEntry[];
  const rowsToAppend = buildSessionRowRecoveryRows(settings, manifest);
  if (rowsToAppend.length !== 8) throw new Error("Expected exactly eight missing settings rows; refusing to continue.");

  const backupPath = resolve(`work/backups/session-row-recovery-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await mkdir(dirname(backupPath), { recursive: true });
  await writeFile(backupPath, JSON.stringify({ spreadsheetId, groupId: SESSION_ROW_RECOVERY_GROUP_ID, settings, capturedAt: new Date().toISOString() }, null, 2), { flag: "wx", mode: 0o600 });
  await chmod(backupPath, 0o600);

  const [currentSettings, currentRecords] = await Promise.all([
    client.readRange(spreadsheetId, "'설정'!A:F"),
    client.readRange(spreadsheetId, "'세션기록'!A:U")
  ]);
  if (
    JSON.stringify(currentSettings) !== JSON.stringify(settings) ||
    currentRecords.filter((row) => SESSION_ROW_RECOVERY_IDS.includes(row[1] as typeof SESSION_ROW_RECOVERY_IDS[number])).length ||
    JSON.stringify(buildSessionRowRecoveryRows(currentSettings, manifest)) !== JSON.stringify(rowsToAppend)
  ) throw new Error(`Sheet changed after the settings backup at ${backupPath}; refusing to write.`);

  await client.appendRows(spreadsheetId, "'설정'!A:F", rowsToAppend);
  const after = await client.readRange(spreadsheetId, "'설정'!A:F");
  const hasExactRow = (expected: string[]) => after.some((row) =>
    Array.from({ length: 6 }, (_, index) => row[index] ?? "").every((value, index) => value === (expected[index] ?? ""))
  );
  if (rowsToAppend.some((row) => !hasExactRow(row))) {
    throw new Error(`Post-write verification failed. Settings backup: ${backupPath}`);
  }
  console.log(JSON.stringify({ ...report, writtenRows: rowsToAppend.length, backupPath, verified: true }, null, 2));
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
