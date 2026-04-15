import type { PAPSSession } from "../../lib/paps/types";

export const sortSessionsByRecency = (sessions: PAPSSession[]): PAPSSession[] =>
  [...sessions].sort(
    (left, right) =>
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
  );
