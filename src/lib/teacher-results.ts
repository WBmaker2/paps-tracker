import type { PAPSSession } from "./paps/types";

export const selectPrimaryResultsSession = (sessions: PAPSSession[]): PAPSSession | null =>
  [...sessions].sort((left, right) => {
    const leftOpenRank = left.isOpen ? 1 : 0;
    const rightOpenRank = right.isOpen ? 1 : 0;

    return (
      rightOpenRank - leftOpenRank ||
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
    );
  })[0] ?? null;
