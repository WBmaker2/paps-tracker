import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  buildSessionRowRecoveryRows,
  SESSION_ROW_LABELS as LABEL,
  SESSION_ROW_RECOVERY_CLASS_IDS as CLASSES,
  SESSION_ROW_RECOVERY_GROUP_ID as GROUP_ID,
  SESSION_ROW_RECOVERY_IDS as IDS,
  type SessionRecoveryManifestEntry
} from "../../src/lib/google/session-row-recovery";

const settings = () => {
  const rows = [[LABEL.group, GROUP_ID, "9월 5, 6학년", "school-1zOhvYPyJEtiM3s5i3-tsYOqUA0AX8S2EJBW0dsqSYNQ", "teacher-ketarou85-dc-es-kr", "2026-09-29T06:20:47.778Z"]];
  const siblingIds = ["session-cardio", "session-flexibility"];
  const siblingEvents = ["shuttle-run", "sit-and-reach"];
  siblingIds.forEach((id, index) => rows.push([LABEL.groupItem, GROUP_ID, id, String(index), siblingEvents[index]!, ""]));
  IDS.forEach((id, index) => rows.push([LABEL.groupItem, GROUP_ID, id, String(index + 2), index === 0 ? "grip-strength" : "standing-long-jump", ""]));
  siblingIds.forEach((id, offset) => {
    const eventId = siblingEvents[offset]!;
    rows.push(
      [LABEL.session, id, "school-1zOhvYPyJEtiM3s5i3-tsYOqUA0AX8S2EJBW0dsqSYNQ", "teacher-ketarou85-dc-es-kr", "2026", `Sibling ${offset}`],
      [LABEL.meta, id, "5", "official", "split", eventId],
      [LABEL.status, id, "Y", "2026-09-29T06:20:47.778Z", "", ""]
    );
  });
  rows.push(
    [LABEL.session, IDS[0], "school-1zOhvYPyJEtiM3s5i3-tsYOqUA0AX8S2EJBW0dsqSYNQ", "teacher-ketarou85-dc-es-kr", "2026", "9월 5, 6학년 - 악력"],
    [LABEL.meta, IDS[0], "5", "official", "split", "grip-strength"]
  );
  return [...rows, ...Array.from({ length: 200 - rows.length }, (_, index) => [`legacy-${index}`, "", "", "", "", ""])];
};

const manifest = (): SessionRecoveryManifestEntry[] => JSON.parse(
  readFileSync(join(import.meta.dirname, "..", "..", "work", "september-session-recovery-manifest.json"), "utf8")
) as SessionRecoveryManifestEntry[];

describe("September session row recovery planner", () => {
  it("plans exactly the eight missing rows, including the grip session status row", () => {
    const planned = buildSessionRowRecoveryRows(settings(), manifest());

    expect(planned).toHaveLength(8);
    expect(planned.filter((row) => row[0] === LABEL.status).map((row) => row[1])).toEqual([...IDS]);
    expect(planned.filter((row) => row[0] === LABEL.session).map((row) => row[1])).toEqual([IDS[1]]);
    expect(planned.filter((row) => row[0] === LABEL.target)).toHaveLength(4);
    expect(planned.find((row) => row[0] === LABEL.session)?.[5]).toBe("9월 5, 6학년 - 제자리멀리뛰기");
  });

  it("refuses an unexpected partially damaged state instead of duplicating target rows", () => {
    const corrupted = settings();
    corrupted.push([LABEL.target, IDS[0], CLASSES[0], "grip-strength", "0", ""]);
    expect(() => buildSessionRowRecoveryRows(corrupted, manifest())).toThrow("expected partial-corruption state");
  });

  it("requires manifest identity and shared fields to match sibling sessions and group items", () => {
    const altered = manifest();
    altered[1]!.teacherId = "different-teacher";
    expect(() => buildSessionRowRecoveryRows(settings(), altered)).toThrow("differs from intact sibling sessions");
    const wrongOrder = manifest();
    wrongOrder[0]!.sessionGroupOrder = 3;
    expect(() => buildSessionRowRecoveryRows(settings(), wrongOrder)).toThrow("does not match the existing group item");
  });
});
