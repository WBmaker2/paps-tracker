import { getEventDefinition } from "../../lib/paps/catalog";
import type { PAPSSession } from "../../lib/paps/types";

export const sortSessionsByRecency = (sessions: PAPSSession[]): PAPSSession[] =>
  [...sessions].sort(
    (left, right) =>
      (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
      left.id.localeCompare(right.id)
  );

export const formatSessionScopeLabel = (session: PAPSSession): string =>
  session.classScope === "split" ? "2반 분할" : "단일 반";

export const formatSessionTypeLabel = (session: PAPSSession): string =>
  session.sessionType === "official" ? "공식" : "연습";

export const formatSessionDetail = (session: PAPSSession): string =>
  `${formatSessionScopeLabel(session)} · ${formatSessionTypeLabel(session)} · ${getEventDefinition(session.eventId).label}`;
