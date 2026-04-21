import { getEventDefinition } from "../../lib/paps/catalog";
import type { PAPSSession } from "../../lib/paps/types";

export type SessionListItem =
  | {
      kind: "group";
      id: string;
      name: string;
      sessions: PAPSSession[];
    }
  | {
      kind: "single";
      id: string;
      session: PAPSSession;
      sessions: PAPSSession[];
    };

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

export const buildSessionListItems = (sessions: PAPSSession[]): SessionListItem[] => {
  const groupedSessions = new Map<string, PAPSSession[]>();
  const singleSessions: PAPSSession[] = [];

  for (const session of sortSessionsByRecency(sessions)) {
    if (!session.sessionGroupId) {
      singleSessions.push(session);
      continue;
    }

    const currentSessions = groupedSessions.get(session.sessionGroupId) ?? [];
    currentSessions.push(session);
    groupedSessions.set(session.sessionGroupId, currentSessions);
  }

  const groupItems: SessionListItem[] = Array.from(groupedSessions.entries()).map(
    ([groupId, groupSessions]) => {
      const sessionsByOrder = [...groupSessions].sort(
        (left, right) =>
          (left.sessionGroupOrder ?? 0) - (right.sessionGroupOrder ?? 0) ||
          left.id.localeCompare(right.id)
      );

      return {
        kind: "group",
        id: groupId,
        name: sessionsByOrder[0]?.sessionGroupName ?? sessionsByOrder[0]?.name ?? groupId,
        sessions: sessionsByOrder
      };
    }
  );

  return [
    ...groupItems,
    ...singleSessions.map((session) => ({
      kind: "single" as const,
      id: session.id,
      session,
      sessions: [session]
    }))
  ].sort((left, right) => {
    const leftCreatedAt = left.sessions[0]?.createdAt ?? "";
    const rightCreatedAt = right.sessions[0]?.createdAt ?? "";

    return rightCreatedAt.localeCompare(leftCreatedAt) || left.id.localeCompare(right.id);
  });
};

export const formatSessionGroupDetail = (sessions: PAPSSession[]): string => {
  const firstSession = sessions[0];
  const eventLabels = sessions
    .map((session) => getEventDefinition(session.eventId).label)
    .join(", ");

  if (!firstSession) {
    return "세션 묶음";
  }

  return `${formatSessionScopeLabel(firstSession)} · ${formatSessionTypeLabel(firstSession)} · ${sessions.length}개 종목 · ${eventLabels}`;
};
