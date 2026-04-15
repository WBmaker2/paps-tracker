"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { PAPSSession } from "../../lib/paps/types";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

export interface SessionStatusListProps {
  sessions: PAPSSession[];
  studentSessionUrls?: Record<string, string>;
  onUpdated?: (session: PAPSSession) => void;
}

export function SessionStatusList({
  sessions,
  studentSessionUrls,
  onUpdated
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

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">세션 상태</h2>
          <p className="mt-1 text-sm text-ink/70">열기와 닫기를 바로 전환할 수 있습니다.</p>
        </div>
        {message ? <p className="text-sm text-ink/70">{message}</p> : null}
      </div>
      <div className="space-y-3">
        {items.map((session) => (
          <article
            key={session.id}
            className="flex flex-col gap-3 rounded-2xl border border-ink/10 px-4 py-3 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-medium">{session.name}</p>
              <p className="text-sm text-ink/65">
                {session.classScope === "split" ? "2반 분할" : "단일 반"} ·{" "}
                {session.sessionType === "official" ? "공식" : "연습"}
              </p>
              {studentSessionUrls?.[session.id] ? (
                <a
                  href={studentSessionUrls[session.id]}
                  className="mt-2 inline-flex text-sm font-medium text-accent underline-offset-2 hover:underline"
                >
                  학생 입력 열기
                </a>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
              onClick={() => toggleOpen(session)}
            >
              {session.isOpen ? "닫기" : "열기"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
