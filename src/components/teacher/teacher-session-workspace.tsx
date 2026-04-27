"use client";

import React, { useMemo, useState } from "react";

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
  studentSessionUrls?: Record<string, string>;
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  showRecentSessions?: boolean;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
  submittedSessionIds?: string[];
}

export function TeacherSessionWorkspace({
  classes,
  sessions,
  studentSessionUrls,
  defaultTeacherId,
  defaultSchoolId,
  showRecentSessions = true,
  sheetConnected = true,
  sheetStatus,
  submittedSessionIds = []
}: TeacherSessionWorkspaceProps) {
  const [sessionItems, setSessionItems] = useState(() => sortSessionsByRecency(sessions));
  const [sessionUrlItems, setSessionUrlItems] = useState(studentSessionUrls ?? {});
  const [editingSession, setEditingSession] = useState<SessionFormDraft | null>(null);
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
    setEditingSession(buildSessionFormDraft(sessionsToEdit));
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
  };

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
        onCancelEdit={handleCancelEdit}
      />
      <div className="space-y-6">
        <SessionStatusList
          sessions={sessionItems}
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
