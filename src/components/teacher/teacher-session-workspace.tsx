"use client";

import React, { useMemo, useRef, useState } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import type { PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import { SessionForm } from "./session-form-card";
import { SessionStatusList } from "./session-status-list";
import {
  buildSessionFormDraft,
  getSessionEntryKey,
  sortSessionsByRecency,
  type SessionFormDraft
} from "./session-workspace-utils";

export interface TeacherSessionWorkspaceProps {
  classes: PAPSClassroom[];
  sessions: PAPSSession[];
  archivedSessions?: PAPSSession[];
  studentSessionUrls?: Record<string, string>;
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  showRecentSessions?: boolean;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
  submittedSessionIds?: string[];
}

const EMPTY_SESSIONS: PAPSSession[] = [];
const EMPTY_SESSION_IDS: string[] = [];

export function TeacherSessionWorkspace({
  classes,
  sessions,
  archivedSessions = EMPTY_SESSIONS,
  studentSessionUrls,
  defaultTeacherId,
  defaultSchoolId,
  showRecentSessions = true,
  sheetConnected = true,
  sheetStatus,
  submittedSessionIds = EMPTY_SESSION_IDS
}: TeacherSessionWorkspaceProps) {
  const [sessionItems, setSessionItems] = useState(() => sortSessionsByRecency(sessions.filter((session) => !session.archivedAt)));
  const [sessionUrlItems, setSessionUrlItems] = useState(studentSessionUrls ?? {});
  const [editingSession, setEditingSession] = useState<SessionFormDraft | null>(null);
  const editReturnTarget = useRef<HTMLElement | null>(null);
  const listDescription = showRecentSessions
    ? "최근 생성 순으로 확인하고 이름 수정, 종목 수정, 열기와 닫기를 바로 전환할 수 있습니다."
    : "세션을 확인하고 이름 수정, 종목 수정, 열기와 닫기를 바로 전환할 수 있습니다.";
  const submittedSessionIdSet = useMemo(() => new Set(submittedSessionIds), [submittedSessionIds]);

  const handleCreated = (createdSessions: PAPSSession[], studentSessionUrl?: string | null) => {
    setSessionItems((currentItems) =>
      sortSessionsByRecency(
        [
          ...createdSessions,
          ...currentItems.filter((entry) => {
            const isReplacedSession = createdSessions.some((session) => session.id === entry.id);
            const isEditedSession =
              editingSession?.sessionIds.some((sessionId) => sessionId === entry.id) ?? false;

            return !isReplacedSession && !isEditedSession;
          })
        ]
      )
    );

    const nextUrlKey = createdSessions[0] ? getSessionEntryKey(createdSessions[0]) : null;

    setSessionUrlItems((currentItems) => {
      const nextItems = { ...currentItems };

      if (editingSession && editingSession.sessionKey !== nextUrlKey) {
        delete nextItems[editingSession.sessionKey];
      }

      if (studentSessionUrl && nextUrlKey) {
        nextItems[nextUrlKey] = studentSessionUrl;
      }

      return nextItems;
    });

    setEditingSession(null);
  };

  const handleUpdated = (session: PAPSSession) => {
    setSessionItems((currentItems) =>
      currentItems.map((entry) => (entry.id === session.id ? session : entry))
    );
  };

  const handleEdit = (sessionsToEdit: PAPSSession[]) => {
    editReturnTarget.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingSession(buildSessionFormDraft(sessionsToEdit));
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    requestAnimationFrame(() => editReturnTarget.current?.focus());
  };

  if (!sheetConnected) {
    return (
      <section className="rounded-[1.75rem] border border-amber-300/70 bg-amber-50 p-6 shadow-sm" aria-labelledby="teacher-first-run-title">
        <p className="text-sm font-semibold text-amber-900">첫 설정이 필요합니다</p>
        <h2 id="teacher-first-run-title" className="mt-2 text-xl font-semibold text-ink">구글 시트를 연결하면 세션을 만들 수 있습니다</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/75">{sheetStatus?.detail ?? sheetStatus?.summary ?? "학교 설정에서 시트 템플릿을 확인하고 학교 시트를 연결해 주세요."}</p>
        <a href="/teacher/settings" className="gi-pulse mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white">학교 시트 연결하기</a>
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <SessionForm
        classes={classes}
        defaultTeacherId={defaultTeacherId}
        defaultSchoolId={defaultSchoolId}
        onCreated={handleCreated}
        sheetConnected={sheetConnected}
        sheetStatus={sheetStatus}
        editingSession={editingSession}
        hasSubmittedRecords={
          editingSession
            ? editingSession.sessionIds.some((sessionId) => submittedSessionIdSet.has(sessionId))
            : false
        }
        protectedEventIds={sessionItems.filter((session) => editingSession?.sessionIds.includes(session.id) && submittedSessionIdSet.has(session.id)).map((session) => session.eventId)}
        hasDuplicateEvents={sessionItems.filter((session) => editingSession?.sessionIds.includes(session.id)).some((session, _, group) => group.filter((entry) => entry.eventId === session.eventId).length > 1)}
        onCancelEdit={handleCancelEdit}
      />
      <div className="space-y-6">
        <SessionStatusList
          sessions={sessionItems}
          archivedSessions={archivedSessions}
          studentSessionUrls={sessionUrlItems}
          onUpdated={handleUpdated}
          onEdit={handleEdit}
          editingSessionKey={editingSession?.sessionKey ?? null}
          title="세션 목록"
          description={listDescription}
        />
      </div>
    </div>
  );
}
