"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { getEligibleEventDefinitions, getSessionTypeEventDefinitions } from "../../lib/paps/catalog";
import type { EventId, PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

export interface SessionFormProps {
  classes: PAPSClassroom[];
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  onCreated?: (sessions: PAPSSession[], studentSessionUrl?: string | null) => void;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
}

const arraysEqual = <T,>(left: T[], right: T[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export function SessionForm({
  classes,
  defaultTeacherId,
  defaultSchoolId,
  onCreated,
  sheetConnected = true,
  sheetStatus
}: SessionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sessionType, setSessionType] = useState<"official" | "practice">("practice");
  const [sessionMode, setSessionMode] = useState<"single-event" | "event-group">("single-event");
  const [classScope, setClassScope] = useState<"single" | "split">("single");
  const [primaryClassId, setPrimaryClassId] = useState(classes[0]?.id ?? "");
  const [secondaryClassId, setSecondaryClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const primaryClass = useMemo(
    () => classes.find((classroom) => classroom.id === primaryClassId) ?? null,
    [classes, primaryClassId]
  );
  const eligibleEvents = useMemo(
    () =>
      classScope === "split"
        ? getSessionTypeEventDefinitions({ sessionType })
        : getEligibleEventDefinitions({
            gradeLevel: primaryClass?.gradeLevel ?? 5,
            sessionType
          }),
    [classScope, primaryClass?.gradeLevel, sessionType]
  );
  const fallbackEventId = eligibleEvents[0]?.id ?? "shuttle-run";
  const [primaryEventId, setPrimaryEventId] = useState<EventId>(fallbackEventId);
  const [selectedEventIds, setSelectedEventIds] = useState<EventId[]>([fallbackEventId]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      primaryEventId !== fallbackEventId &&
      !eligibleEvents.some((eventDefinition) => eventDefinition.id === primaryEventId)
    ) {
      setPrimaryEventId(fallbackEventId);
    }
  }, [eligibleEvents, fallbackEventId, primaryEventId]);

  useEffect(() => {
    const eligibleEventIds = new Set(eligibleEvents.map((eventDefinition) => eventDefinition.id));
    const nextEventIds = selectedEventIds.filter((eventId) => eligibleEventIds.has(eventId));
    const fallbackEventIds = eligibleEventIds.has(fallbackEventId) ? [fallbackEventId] : [];

    if (nextEventIds.length === 0) {
      if (!arraysEqual(selectedEventIds, fallbackEventIds)) {
        setSelectedEventIds(fallbackEventIds);
      }
      return;
    }

    if (!arraysEqual(selectedEventIds, nextEventIds)) {
      setSelectedEventIds(nextEventIds);
    }
  }, [eligibleEvents, fallbackEventId, selectedEventIds]);

  useEffect(() => {
    if (classes.length === 0) {
      return;
    }

    if (!classes.some((classroom) => classroom.id === primaryClassId)) {
      setPrimaryClassId(classes[0]!.id);
    }

    if (!classes.some((classroom) => classroom.id === secondaryClassId)) {
      setSecondaryClassId(classes[1]?.id ?? classes[0]!.id);
      return;
    }

    if (classScope === "split" && secondaryClassId === primaryClassId) {
      const alternateClass = classes.find((classroom) => classroom.id !== primaryClassId) ?? null;

      if (alternateClass) {
        setSecondaryClassId(alternateClass.id);
      }
    }
  }, [classScope, classes, primaryClassId, secondaryClassId]);

  const handleSubmit = () => {
    if (!sheetConnected) {
      setFeedback(null);
      setErrorMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    if (sessionMode === "event-group" && selectedEventIds.length < 2) {
      setErrorMessage("여러 종목 묶음은 종목을 2개 이상 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/sessions", {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            name,
            sessionType,
            classScope,
            primaryClassId,
            secondaryClassId: classScope === "split" ? secondaryClassId : undefined,
            primaryEventId,
            eventIds: sessionMode === "event-group" ? selectedEventIds : undefined,
            teacherId: defaultTeacherId,
            schoolId: defaultSchoolId,
            isOpen: true
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: PAPSSession;
          sessions?: PAPSSession[];
          studentSessionUrl?: string | null;
          teacherStateVersion?: string;
        };

        const createdSessions =
          payload.sessions ?? (payload.session ? [payload.session] : []);

        if (!response.ok || createdSessions.length === 0) {
          throw new Error(payload.error ?? "세션을 저장하지 못했습니다.");
        }

        setFeedback(
          sessionMode === "event-group" ? "세션 묶음을 저장했습니다." : "세션을 저장했습니다."
        );
        setName("");
        onCreated?.(createdSessions, payload.studentSessionUrl ?? null);
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
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
      {!sheetConnected ? (
        <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink/80">
          {sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요."}
        </div>
      ) : null}
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
          세션 구성
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={sessionMode}
            onChange={(event) => setSessionMode(event.target.value as typeof sessionMode)}
          >
            <option value="single-event">단일 종목</option>
            <option value="event-group">여러 종목 묶음</option>
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
                {classroom.label} ({classroom.gradeLevel}학년)
              </option>
            ))}
          </select>
        </label>
        {sessionMode === "single-event" ? (
          <label className="flex flex-col gap-2 text-sm">
            주 종목
            <select
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={primaryEventId}
              onChange={(event) => setPrimaryEventId(event.target.value as EventId)}
            >
              {eligibleEvents.map((eventDefinition) => (
                <option key={eventDefinition.id} value={eventDefinition.id}>
                  {eventDefinition.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <fieldset className="rounded-2xl border border-ink/10 px-4 py-3 md:col-span-2">
            <legend className="px-1 text-sm font-medium">기록할 종목</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {eligibleEvents.map((eventDefinition) => {
                const checked = selectedEventIds.includes(eventDefinition.id);

                return (
                  <label
                    key={eventDefinition.id}
                    className="flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setSelectedEventIds((currentEventIds) =>
                          event.target.checked
                            ? Array.from(new Set([...currentEventIds, eventDefinition.id]))
                            : currentEventIds.filter((eventId) => eventId !== eventDefinition.id)
                        );
                      }}
                    />
                    {eventDefinition.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
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
                    {classroom.label} ({classroom.gradeLevel}학년)
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
      </div>
      {classScope === "split" ? (
        <p className="mt-3 text-sm text-ink/65">
          2반 분할은 학년과 무관하게 두 반을 선택하고, 두 반이 같은 종목으로 함께 기록합니다.
        </p>
      ) : null}
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
