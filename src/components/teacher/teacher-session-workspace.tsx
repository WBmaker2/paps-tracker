"use client";

import React, { useState } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import type { PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import { SessionForm } from "./session-form-card";
import { SessionStatusList } from "./session-status-list";
import { sortSessionsByRecency } from "./session-workspace-utils";

export interface TeacherSessionWorkspaceProps {
  classes: PAPSClassroom[];
  sessions: PAPSSession[];
  studentSessionUrls?: Record<string, string>;
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  showRecentSessions?: boolean;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
}

export function TeacherSessionWorkspace({
  classes,
  sessions,
  studentSessionUrls,
  defaultTeacherId,
  defaultSchoolId,
  showRecentSessions = true,
  sheetConnected = true,
  sheetStatus
}: TeacherSessionWorkspaceProps) {
  const [sessionItems, setSessionItems] = useState(() => sortSessionsByRecency(sessions));
  const [sessionUrlItems, setSessionUrlItems] = useState(studentSessionUrls ?? {});
  const listDescription = showRecentSessions
    ? "최근 생성 순으로 확인하고 열기와 닫기를 바로 전환할 수 있습니다."
    : "세션을 확인하고 열기와 닫기를 바로 전환할 수 있습니다.";

  const handleCreated = (createdSessions: PAPSSession[], studentSessionUrl?: string | null) => {
    setSessionItems((currentItems) =>
      sortSessionsByRecency([
        ...createdSessions,
        ...currentItems.filter(
          (entry) => !createdSessions.some((session) => session.id === entry.id)
        )
      ])
    );

    if (studentSessionUrl) {
      const urlKey = createdSessions[0]?.sessionGroupId ?? createdSessions[0]?.id;

      setSessionUrlItems((currentItems) => ({
        ...currentItems,
        ...(urlKey ? { [urlKey]: studentSessionUrl } : {})
      }));
    }
  };

  const handleUpdated = (session: PAPSSession) => {
    setSessionItems((currentItems) =>
      currentItems.map((entry) => (entry.id === session.id ? session : entry))
    );
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
      />
      <div className="space-y-6">
        <SessionStatusList
          sessions={sessionItems}
          studentSessionUrls={sessionUrlItems}
          onUpdated={handleUpdated}
          title="세션 목록"
          description={listDescription}
        />
      </div>
    </div>
  );
}
