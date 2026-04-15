"use client";

import React, { useState } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { getEventDefinition } from "../../lib/paps/catalog";
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

function RecentSessionsCard({
  sessions,
  studentSessionUrls
}: {
  sessions: PAPSSession[];
  studentSessionUrls: Record<string, string>;
}) {
  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">최근 세션</h2>
      <div className="mt-4 space-y-3">
        {sessions.slice(0, 4).map((session) => (
          <article key={session.id} className="rounded-2xl border border-ink/10 px-4 py-3">
            <p className="font-medium">{session.name}</p>
            <p className="mt-1 text-sm text-ink/65">
              {session.classScope === "split" ? "2반 분할" : "단일 반"} ·{" "}
              {getEventDefinition(session.eventId).label}
            </p>
            {studentSessionUrls[session.id] ? (
              <a
                href={studentSessionUrls[session.id]}
                className="mt-2 inline-flex text-sm font-medium text-accent underline-offset-2 hover:underline"
              >
                학생 입력 열기
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
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

  const handleCreated = (session: PAPSSession, studentSessionUrl?: string | null) => {
    setSessionItems((currentItems) =>
      sortSessionsByRecency([session, ...currentItems.filter((entry) => entry.id !== session.id)])
    );

    if (studentSessionUrl) {
      setSessionUrlItems((currentItems) => ({
        ...currentItems,
        [session.id]: studentSessionUrl
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
        {showRecentSessions ? (
          <RecentSessionsCard sessions={sessionItems} studentSessionUrls={sessionUrlItems} />
        ) : null}
        <SessionStatusList
          sessions={sessionItems}
          studentSessionUrls={sessionUrlItems}
          onUpdated={handleUpdated}
        />
      </div>
    </div>
  );
}
