export const SESSION_ROW_RECOVERY_GROUP_ID = "77bd0c26-2fe1-42c8-934f-5373d96a5b2a";
export const SESSION_ROW_RECOVERY_IDS = [
  "2e4124e3-a6b1-4cd1-b53a-dccdf4a0072d",
  "e594181b-1632-4c2f-bfe3-1033f5b3b392"
] as const;
export const SESSION_ROW_RECOVERY_CLASS_IDS = [
  "8582148a-9efe-434d-a3f9-64d8800c07b3",
  "6b536ba9-6a07-4289-972f-f2661e8967ee"
] as const;

export const SESSION_ROW_LABELS = {
  session: "__PAPS_SESSION",
  group: "__PAPS_SESSION_GROUP",
  groupItem: "__PAPS_SESSION_GROUP_ITEM",
  meta: "__PAPS_SESSION_META",
  status: "__PAPS_SESSION_STATUS",
  target: "__PAPS_SESSION_TARGET"
} as const;

export interface SessionRecoveryManifestEntry {
  id: string;
  name: string;
  schoolId: string;
  teacherId: string;
  academicYear: number;
  gradeLevel: number;
  sessionType: string;
  classScope: string;
  eventId: string;
  sessionGroupOrder: number;
  createdAt: string;
  classTargets: Array<{ classId: string; eventId: string }>;
}

const gripId = SESSION_ROW_RECOVERY_IDS[0];
const jumpId = SESSION_ROW_RECOVERY_IDS[1];
const requiredCount = (rows: string[][], label: string, sessionId: string) =>
  rows.filter((row) => row[0] === label && row[1] === sessionId);

export const buildSessionRowRecoveryRows = (
  settings: string[][],
  manifest: SessionRecoveryManifestEntry[]
): string[][] => {
  if (manifest.length !== 2 || new Set(manifest.map((entry) => entry.id)).size !== 2 ||
      SESSION_ROW_RECOVERY_IDS.some((id) => !manifest.some((entry) => entry.id === id))) {
    throw new Error("Manifest must contain exactly the two allowlisted session IDs.");
  }

  const items = settings.filter((row) => row[0] === SESSION_ROW_LABELS.groupItem && row[1] === SESSION_ROW_RECOVERY_GROUP_ID);
  if (items.length !== 4 || SESSION_ROW_RECOVERY_IDS.some((id) => items.filter((row) => row[2] === id).length !== 1)) {
    throw new Error("Target group contents changed; refusing to continue.");
  }
  const groupRow = settings.filter((row) => row[0] === SESSION_ROW_LABELS.group && row[1] === SESSION_ROW_RECOVERY_GROUP_ID);
  if (groupRow.length !== 1) throw new Error("Target group metadata is missing or duplicated.");

  const referenceSessions = items
    .filter((row) => !SESSION_ROW_RECOVERY_IDS.includes(row[2] as typeof SESSION_ROW_RECOVERY_IDS[number]))
    .map((item) => {
      const id = item[2] ?? "";
      const session = requiredCount(settings, SESSION_ROW_LABELS.session, id);
      const meta = requiredCount(settings, SESSION_ROW_LABELS.meta, id);
      const status = requiredCount(settings, SESSION_ROW_LABELS.status, id);
      if (session.length !== 1 || meta.length !== 1 || status.length !== 1) {
        throw new Error(`Reference session ${id} is incomplete; refusing to infer recovery data.`);
      }
      return { item, session: session[0]!, meta: meta[0]!, status: status[0]! };
    });
  if (referenceSessions.length !== 2) throw new Error("Two intact sibling sessions are required to validate the manifest.");
  const [reference] = referenceSessions;
  const commonFields = [reference.session[2], reference.session[3], reference.session[4], reference.meta[2], reference.meta[3], reference.meta[4], reference.status[3]];
  for (const sibling of referenceSessions.slice(1)) {
    const siblingFields = [sibling.session[2], sibling.session[3], sibling.session[4], sibling.meta[2], sibling.meta[3], sibling.meta[4], sibling.status[3]];
    if (siblingFields.some((value, index) => value !== commonFields[index])) {
      throw new Error("Sibling sessions disagree on shared group metadata; refusing to infer recovery data.");
    }
  }

  const rowsToAppend: string[][] = [];
  for (const entry of manifest) {
    const groupItem = items.find((row) => row[2] === entry.id)!;
    const expectedEvent = entry.id === gripId ? "grip-strength" : "standing-long-jump";
    if (
      entry.eventId !== expectedEvent || groupItem[4] !== entry.eventId ||
      Number(groupItem[3]) !== entry.sessionGroupOrder ||
      entry.classTargets.length !== 2 ||
      new Set(entry.classTargets.map((target) => target.classId)).size !== 2 ||
      SESSION_ROW_RECOVERY_CLASS_IDS.some((id) => !entry.classTargets.some((target) => target.classId === id)) ||
      entry.classTargets.some((target) => target.eventId !== entry.eventId)
    ) throw new Error(`Manifest does not match the existing group item for ${entry.id}.`);
    const fields = [entry.schoolId, entry.teacherId, String(entry.academicYear), String(entry.gradeLevel), entry.sessionType, entry.classScope, entry.createdAt];
    if (fields.some((value, index) => value !== commonFields[index])) {
      throw new Error(`Manifest metadata differs from intact sibling sessions for ${entry.id}.`);
    }

    const sessionRows = requiredCount(settings, SESSION_ROW_LABELS.session, entry.id);
    const metaRows = requiredCount(settings, SESSION_ROW_LABELS.meta, entry.id);
    const statusRows = requiredCount(settings, SESSION_ROW_LABELS.status, entry.id);
    const targetRows = requiredCount(settings, SESSION_ROW_LABELS.target, entry.id);
    const expectedExisting = entry.id === gripId ? [1, 1, 0, 0] : [0, 0, 0, 0];
    if ([sessionRows.length, metaRows.length, statusRows.length, targetRows.length].some((count, index) => count !== expectedExisting[index])) {
      throw new Error(`Target session ${entry.id} is not in the expected partial-corruption state; refusing to continue.`);
    }

    if (entry.id === jumpId) {
      rowsToAppend.push(
        [SESSION_ROW_LABELS.session, entry.id, entry.schoolId, entry.teacherId, String(entry.academicYear), entry.name],
        [SESSION_ROW_LABELS.meta, entry.id, String(entry.gradeLevel), entry.sessionType, entry.classScope, entry.eventId]
      );
    }
    rowsToAppend.push([
      SESSION_ROW_LABELS.status,
      entry.id,
      reference.status[2] ?? "Y",
      entry.createdAt,
      reference.status[4] ?? "",
      reference.status[5] ?? ""
    ]);
    entry.classTargets.forEach((target, index) => {
      rowsToAppend.push([SESSION_ROW_LABELS.target, entry.id, target.classId, target.eventId, String(index), ""]);
    });
  }
  if (rowsToAppend.length !== 8) throw new Error("Expected exactly eight missing settings rows; refusing to continue.");
  return rowsToAppend;
};
