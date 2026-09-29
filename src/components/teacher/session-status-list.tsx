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
  archivedSessions?: PAPSSession[];
  studentSessionUrls?: Record<string, string>;
  onUpdated?: (session: PAPSSession) => void;
  onEdit?: (sessions: PAPSSession[]) => void;
  editingSessionKey?: string | null;
  title?: string;
  description?: string;
}

const EMPTY_SESSIONS: PAPSSession[] = [];

export function SessionStatusList({
  sessions,
  archivedSessions = EMPTY_SESSIONS,
  studentSessionUrls,
  onUpdated,
  onEdit,
  editingSessionKey = null,
  title = "세션 목록",
  description = "최근 생성 순으로 확인하고 열기와 닫기를 바로 전환할 수 있습니다."
}: SessionStatusListProps) {
  const [items, setItems] = useState(sessions);
  const [archivedItems, setArchivedItems] = useState(archivedSessions);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(sessions);
  }, [sessions]);

  useEffect(() => setArchivedItems(archivedSessions), [archivedSessions]);

  const removeSessions = (target: PAPSSession[]) => {
    const label = target[0]?.sessionGroupName ?? target[0]?.name ?? "세션";
    if (!window.confirm(`'${label}' 세션을 목록에서 제거하시겠습니까? 기록이 있는 세션은 보관되어 복원할 수 있습니다.`)) return;
    startTransition(async () => {
      try {
        const response = await fetch(`/api/sessions/${target[0]!.id}`, { method: "DELETE", headers: buildTeacherMutationHeaders() });
        const payload = (await response.json()) as { error?: string; action?: string; affectedSessionIds?: string[] };
        if (!response.ok) throw new Error(payload.error ?? "세션을 제거하지 못했습니다.");
        const ids = new Set(payload.affectedSessionIds ?? target.map((entry) => entry.id));
        const changed = items.filter((entry) => ids.has(entry.id));
        setItems((current) => current.filter((entry) => !ids.has(entry.id)));
        if (payload.action === "archived") setArchivedItems((current) => [...current, ...changed.map((entry) => ({ ...entry, isOpenBeforeArchive: entry.isOpen !== false, isOpen: false, archivedAt: new Date().toISOString() }))]);
        setMessage(payload.action === "archived" ? "기록을 보존해 세션을 보관했습니다. 아래 보관 목록에서 복원할 수 있습니다." : "세션을 삭제했습니다.");
        notifyTeacherDataRefresh({ refresh: true, nextVersion: null });
      } catch (error) { setMessage(error instanceof Error ? error.message : "세션을 제거하지 못했습니다."); }
    });
  };

  const restoreSession = (session: PAPSSession) => startTransition(async () => {
    try {
      const response = await fetch(`/api/sessions/${session.id}`, { method: "PATCH", headers: buildTeacherMutationHeaders({ "content-type": "application/json" }), body: JSON.stringify({ restore: true }) });
      const payload = (await response.json()) as { error?: string; sessions?: PAPSSession[] };
      if (!response.ok || !payload.sessions) throw new Error(payload.error ?? "복원하지 못했습니다.");
      const ids = new Set(payload.sessions.map((entry) => entry.id));
      setArchivedItems((current) => current.filter((entry) => !ids.has(entry.id)));
      setItems((current) => [...current.filter((entry) => !ids.has(entry.id)), ...payload.sessions!]);
      setMessage("세션을 복원했습니다.");
      notifyTeacherDataRefresh({ refresh: true, nextVersion: null });
    } catch (error) { setMessage(error instanceof Error ? error.message : "복원하지 못했습니다."); }
  });

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
        {message ? <p role="status" aria-live="polite" className="text-sm text-ink/70">{message}</p> : null}
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
                  <div className="flex flex-wrap items-center gap-2">
                    {onEdit ? (
                      item.sessions.some((session) => session.assessmentRoundId) ? (
                        <span className="rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-xs font-medium text-accent">
                          회차 결과에서 관리
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="min-h-12 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold"
                          onClick={() => onEdit(item.sessions)}
                        >
                          {editingSessionKey === item.id ? `${item.name} 수정 중` : `${item.name} 수정`}
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      className="min-h-12 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold"
                      onClick={() => toggleGroupOpen(item.sessions)}
                    >
                      {item.sessions.some((session) => session.isOpen !== false) ? "닫기" : "열기"}
                    </button>
                    <button type="button" className="min-h-12 rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700" onClick={() => removeSessions(item.sessions)}>삭제</button>
                  </div>
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
                  <div className="flex flex-wrap items-center gap-2">
                    {onEdit ? (
                      item.session.assessmentRoundId ? (
                        <span className="rounded-full border border-accent/20 bg-accent/5 px-4 py-2 text-xs font-medium text-accent">
                          회차 결과에서 관리
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="min-h-12 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold"
                          onClick={() => onEdit([item.session])}
                        >
                          {editingSessionKey === item.id
                            ? `${item.session.name ?? "세션"} 수정 중`
                            : `${item.session.name ?? "세션"} 수정`}
                        </button>
                      )
                    ) : null}
                    <button
                      type="button"
                      className="min-h-12 rounded-full border border-ink/15 px-5 py-3 text-sm font-semibold"
                      onClick={() => toggleOpen(item.session)}
                    >
                      {item.session.isOpen ? "닫기" : "열기"}
                    </button>
                    <button type="button" className="min-h-12 rounded-full border border-red-200 px-5 py-3 text-sm font-semibold text-red-700" onClick={() => removeSessions([item.session])}>삭제</button>
                  </div>
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
      {archivedItems.length > 0 ? <div className="mt-5 border-t border-ink/10 pt-4"><h3 className="font-semibold">보관된 세션</h3><ul className="mt-2 space-y-2">{buildSessionListItems(archivedItems).map((entry) => <li key={entry.id} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm"><span>{entry.kind === "group" ? entry.name : entry.session.name}</span><button type="button" className="rounded-full border border-ink/15 px-4 py-2 font-semibold" onClick={() => restoreSession(entry.kind === "group" ? entry.sessions[0]! : entry.session)}>복원</button></li>)}</ul></div> : null}
    </section>
  );
}
