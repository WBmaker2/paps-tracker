"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { PAPSSession } from "../../lib/paps/types";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";
import {
  buildSessionListItems,
  formatSessionDetail,
  formatSessionGroupDetail
} from "./session-workspace-utils";

export interface SessionStatusListProps {
  sessions: PAPSSession[];
  studentSessionUrls?: Record<string, string>;
  onUpdated?: (session: PAPSSession) => void;
  title?: string;
  description?: string;
}

export function SessionStatusList({
  sessions,
  studentSessionUrls,
  onUpdated,
  title = "세션 목록",
  description = "최근 생성 순으로 확인하고 열기와 닫기를 바로 전환할 수 있습니다."
}: SessionStatusListProps) {
  const [items, setItems] = useState(sessions);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(sessions);
  }, [sessions]);

  const toggleOpen = (session: PAPSSession) => {
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            isOpen: !session.isOpen
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: PAPSSession;
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.session) {
          throw new Error(payload.error ?? "세션 상태를 변경하지 못했습니다.");
        }

        setItems((currentItems) =>
          currentItems.map((entry) => (entry.id === payload.session?.id ? payload.session : entry))
        );
        setMessage("세션 상태를 업데이트했습니다.");
        onUpdated?.(payload.session);
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "세션 상태를 변경하지 못했습니다.");
      }
    });
  };

  const toggleGroupOpen = (sessions: PAPSSession[]) => {
    const nextOpen = !sessions.some((session) => session.isOpen !== false);
    setMessage(null);

    startTransition(async () => {
      try {
        const updatedSessions: PAPSSession[] = [];
        let nextVersion: string | null = null;

        for (const session of sessions) {
          const response = await fetch(`/api/sessions/${session.id}`, {
            method: "PATCH",
            headers: buildTeacherMutationHeaders({
              "content-type": "application/json"
            }),
            body: JSON.stringify({
              isOpen: nextOpen
            })
          });
          const payload = (await response.json()) as {
            error?: string;
            session?: PAPSSession;
            teacherStateVersion?: string;
          };

          if (!response.ok || !payload.session) {
            throw new Error(payload.error ?? "세션 상태를 변경하지 못했습니다.");
          }

          updatedSessions.push(payload.session);
          nextVersion = payload.teacherStateVersion ?? nextVersion;
        }

        setItems((currentItems) =>
          currentItems.map(
            (entry) => updatedSessions.find((session) => session.id === entry.id) ?? entry
          )
        );
        setMessage("세션 묶음 상태를 업데이트했습니다.");
        updatedSessions.forEach((session) => onUpdated?.(session));
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "세션 상태를 변경하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-ink/70">{description}</p>
        </div>
        {message ? <p className="text-sm text-ink/70">{message}</p> : null}
      </div>
      <div className="space-y-3">
        {items.length > 0 ? (
          buildSessionListItems(items).map((item) => (
            <article
              key={item.id}
              className="flex flex-col gap-3 rounded-2xl border border-ink/10 px-4 py-3 md:flex-row md:items-center md:justify-between"
            >
              {item.kind === "group" ? (
                <>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-ink/65">{formatSessionGroupDetail(item.sessions)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.sessions.map((session) => (
                        <span
                          key={session.id}
                          className="rounded-full bg-canvas px-3 py-1 text-xs text-ink/70"
                        >
                          {formatSessionDetail(session).split(" · ").at(-1)}
                          {session.isOpen === false ? " · 닫힘" : ""}
                        </span>
                      ))}
                    </div>
                    {studentSessionUrls?.[item.id] ? (
                      <a
                        href={studentSessionUrls[item.id]}
                        className="mt-2 inline-flex text-sm font-medium text-accent underline-offset-2 hover:underline"
                      >
                        학생 입력 열기
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
                    onClick={() => toggleGroupOpen(item.sessions)}
                  >
                    {item.sessions.some((session) => session.isOpen !== false) ? "닫기" : "열기"}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{item.session.name}</p>
                    <p className="text-sm text-ink/65">{formatSessionDetail(item.session)}</p>
                    {studentSessionUrls?.[item.session.id] ? (
                      <a
                        href={studentSessionUrls[item.session.id]}
                        className="mt-2 inline-flex text-sm font-medium text-accent underline-offset-2 hover:underline"
                      >
                        학생 입력 열기
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
                    onClick={() => toggleOpen(item.session)}
                  >
                    {item.session.isOpen ? "닫기" : "열기"}
                  </button>
                </>
              )}
            </article>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-ink/10 px-4 py-6 text-sm text-ink/60">
            아직 생성된 세션이 없습니다.
          </div>
        )}
      </div>
    </section>
  );
}
