"use client";

import React, { useEffect, useState, useTransition } from "react";

import { getEventDefinition } from "../../lib/paps/catalog";
import type { PAPSClassroom, PAPSSession } from "../../lib/paps/types";

const EVENT_OPTIONS = [
  { value: "sit-and-reach", label: "앉아윗몸앞으로굽히기" },
  { value: "shuttle-run", label: "왕복오래달리기" },
  { value: "long-run-walk", label: "오래달리기-걷기" }
] as const;

export function SessionForm({
  classes,
  defaultTeacherId,
  defaultSchoolId,
  onCreated,
  sheetConnected = true
}: {
  classes: PAPSClassroom[];
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  onCreated?: (session: PAPSSession) => void;
  sheetConnected?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("5");
  const [sessionType, setSessionType] = useState<"official" | "practice">("practice");
  const [classScope, setClassScope] = useState<"single" | "split">("single");
  const [primaryClassId, setPrimaryClassId] = useState(classes[0]?.id ?? "");
  const [secondaryClassId, setSecondaryClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const [primaryEventId, setPrimaryEventId] = useState<"sit-and-reach" | "shuttle-run" | "long-run-walk">("sit-and-reach");
  const [secondaryEventId, setSecondaryEventId] = useState<"sit-and-reach" | "shuttle-run" | "long-run-walk">("sit-and-reach");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!sheetConnected) {
      setFeedback(null);
      setErrorMessage("구글 시트를 먼저 연결해주세요.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name,
            gradeLevel: Number(gradeLevel),
            sessionType,
            classScope,
            primaryClassId,
            secondaryClassId: classScope === "split" ? secondaryClassId : undefined,
            primaryEventId,
            secondaryEventId: classScope === "split" ? secondaryEventId : undefined,
            teacherId: defaultTeacherId,
            schoolId: defaultSchoolId,
            isOpen: true
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: PAPSSession;
        };

        if (!response.ok || !payload.session) {
          throw new Error(payload.error ?? "세션을 저장하지 못했습니다.");
        }

        setFeedback("세션을 저장했습니다.");
        setName("");
        onCreated?.(payload.session);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "세션을 저장하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">세션 생성</h2>
        <p className="mt-1 text-sm text-ink/70">
          단일 반 또는 2반 분할 세션을 바로 생성하고 열림 상태로 시작합니다.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          세션 이름
          <input
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          학년
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={gradeLevel}
            onChange={(event) => setGradeLevel(event.target.value)}
          >
            {[3, 4, 5, 6].map((value) => (
              <option key={value} value={value}>
                {value}학년
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          세션 유형
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={sessionType}
            onChange={(event) => setSessionType(event.target.value as "official" | "practice")}
          >
            <option value="official">공식</option>
            <option value="practice">연습</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          운영 방식
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={classScope}
            onChange={(event) => setClassScope(event.target.value as "single" | "split")}
          >
            <option value="single">단일 반</option>
            <option value="split">2반 분할</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          주 반
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={primaryClassId}
            onChange={(event) => setPrimaryClassId(event.target.value)}
          >
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          주 종목
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={primaryEventId}
            onChange={(event) =>
              setPrimaryEventId(
                event.target.value as "sit-and-reach" | "shuttle-run" | "long-run-walk"
              )
            }
          >
            {EVENT_OPTIONS.map((eventOption) => (
              <option key={eventOption.value} value={eventOption.value}>
                {eventOption.label}
              </option>
            ))}
          </select>
        </label>
        {classScope === "split" ? (
          <>
            <label className="flex flex-col gap-2 text-sm">
              보조 반
              <select
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={secondaryClassId}
                onChange={(event) => setSecondaryClassId(event.target.value)}
              >
                {classes.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              보조 종목
              <select
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={secondaryEventId}
                onChange={(event) =>
                  setSecondaryEventId(
                    event.target.value as "sit-and-reach" | "shuttle-run" | "long-run-walk"
                  )
                }
              >
                {EVENT_OPTIONS.map((eventOption) => (
                  <option key={eventOption.value} value={eventOption.value}>
                    {eventOption.label}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSubmit}
          disabled={isPending}
        >
          세션 저장
        </button>
        {feedback ? <p className="text-sm font-medium text-emerald-700">{feedback}</p> : null}
        {errorMessage ? <p className="text-sm font-medium text-rose-700">{errorMessage}</p> : null}
      </div>
    </section>
  );
}

export function SessionStatusList({
  sessions,
  onUpdated
}: {
  sessions: PAPSSession[];
  onUpdated?: (session: PAPSSession) => void;
}) {
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
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            isOpen: !session.isOpen
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: PAPSSession;
        };

        if (!response.ok || !payload.session) {
          throw new Error(payload.error ?? "세션 상태를 변경하지 못했습니다.");
        }

        setItems((currentItems) =>
          currentItems.map((entry) => (entry.id === payload.session?.id ? payload.session : entry))
        );
        setMessage("세션 상태를 업데이트했습니다.");
        onUpdated?.(payload.session);
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

export function TeacherSessionWorkspace({
  classes,
  sessions,
  defaultTeacherId,
  defaultSchoolId,
  showRecentSessions = true,
  sheetConnected = true
}: {
  classes: PAPSClassroom[];
  sessions: PAPSSession[];
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  showRecentSessions?: boolean;
  sheetConnected?: boolean;
}) {
  const [sessionItems, setSessionItems] = useState(
    [...sessions].sort(
      (left, right) =>
        (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
        left.id.localeCompare(right.id)
    )
  );

  const handleCreated = (session: PAPSSession) => {
    setSessionItems((currentItems) =>
      [session, ...currentItems.filter((entry) => entry.id !== session.id)].sort(
        (left, right) =>
          (right.createdAt?.localeCompare(left.createdAt ?? "") ?? 0) ||
          left.id.localeCompare(right.id)
      )
    );
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
      />
      <div className="space-y-6">
        {showRecentSessions ? (
          <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">최근 세션</h2>
            <div className="mt-4 space-y-3">
              {sessionItems.slice(0, 4).map((session) => (
                <article key={session.id} className="rounded-2xl border border-ink/10 px-4 py-3">
                  <p className="font-medium">{session.name}</p>
                  <p className="mt-1 text-sm text-ink/65">
                    {session.classScope === "split" ? "2반 분할" : "단일 반"} ·{" "}
                    {getEventDefinition(session.eventId).label}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <SessionStatusList sessions={sessionItems} onUpdated={handleUpdated} />
      </div>
    </div>
  );
}
