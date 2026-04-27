"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { getEligibleEventDefinitions, getSessionTypeEventDefinitions } from "../../lib/paps/catalog";
import type { EventId, PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";
import type { SessionFormDraft } from "./session-workspace-utils";

export interface SessionFormProps {
  classes: PAPSClassroom[];
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  onCreated?: (sessions: PAPSSession[], studentSessionUrl?: string | null) => void;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
  editingSession?: SessionFormDraft | null;
  hasSubmittedRecords?: boolean;
  onCancelEdit?: () => void;
}

const arraysEqual = <T,>(left: T[], right: T[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const orderSelectedEventIds = (
  eligibleEvents: Array<{ id: EventId }>,
  selectedEventIds: EventId[]
): EventId[] =>
  selectedEventIds.filter((eventId) =>
    eligibleEvents.some((eventDefinition) => eventDefinition.id === eventId)
  );

export function SessionForm({
  classes,
  defaultTeacherId,
  defaultSchoolId,
  onCreated,
  sheetConnected = true,
  sheetStatus,
  editingSession = null,
  hasSubmittedRecords = false,
  onCancelEdit
}: SessionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [sessionType, setSessionType] = useState<"official" | "practice">("practice");
  const [classScope, setClassScope] = useState<"single" | "split">("single");
  const [primaryClassId, setPrimaryClassId] = useState(classes[0]?.id ?? "");
  const [secondaryClassId, setSecondaryClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const [selectedEventIds, setSelectedEventIds] = useState<EventId[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isEditing = editingSession !== null;
  const isStructureLocked = isEditing && hasSubmittedRecords;
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
  const orderedSelectedEventIds = useMemo(
    () => orderSelectedEventIds(eligibleEvents, selectedEventIds),
    [eligibleEvents, selectedEventIds]
  );

  useEffect(() => {
    const eligibleEventIds = new Set(eligibleEvents.map((eventDefinition) => eventDefinition.id));
    const nextEventIds = selectedEventIds.filter((eventId) => eligibleEventIds.has(eventId));

    if (!arraysEqual(selectedEventIds, nextEventIds)) {
      setSelectedEventIds(nextEventIds);
    }
  }, [eligibleEvents, selectedEventIds]);

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

  useEffect(() => {
    setErrorMessage(null);

    if (editingSession) {
      setName(editingSession.name);
      setSessionType(editingSession.sessionType);
      setClassScope(editingSession.classScope);
      setPrimaryClassId(editingSession.primaryClassId || (classes[0]?.id ?? ""));
      setSecondaryClassId(
        editingSession.secondaryClassId || classes[1]?.id || classes[0]?.id || ""
      );
      setSelectedEventIds(editingSession.eventIds);
      return;
    }

    setName("");
    setSessionType("practice");
    setClassScope("single");
    setPrimaryClassId(classes[0]?.id ?? "");
    setSecondaryClassId(classes[1]?.id ?? classes[0]?.id ?? "");
    setSelectedEventIds([]);
  }, [editingSession, classes]);

  const handleSubmit = () => {
    if (!sheetConnected) {
      setFeedback(null);
      setErrorMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    if (orderedSelectedEventIds.length === 0) {
      setErrorMessage("종목을 1개 이상 선택해주세요.");
      return;
    }

    const primaryEventId = orderedSelectedEventIds[0];

    if (!primaryEventId) {
      setErrorMessage("종목을 1개 이상 선택해주세요.");
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
            eventIds: orderedSelectedEventIds,
            teacherId: defaultTeacherId,
            schoolId: defaultSchoolId,
            ...(!isEditing ? { isOpen: true } : {}),
            ...(editingSession
              ? editingSession.sessionIds.length > 1
                ? { sessionGroupId: editingSession.sessionKey }
                : { id: editingSession.sessionIds[0] }
              : {})
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          session?: PAPSSession;
          sessions?: PAPSSession[];
          studentSessionUrl?: string | null;
          teacherStateVersion?: string;
        };

        const savedSessions =
          payload.sessions ?? (payload.session ? [payload.session] : []);

        if (!response.ok || savedSessions.length === 0) {
          throw new Error(payload.error ?? "세션을 저장하지 못했습니다.");
        }

        setFeedback(
          isEditing
            ? "세션을 수정했습니다."
            : orderedSelectedEventIds.length > 1
              ? "세션 묶음을 저장했습니다."
              : "세션을 저장했습니다."
        );

        if (!isEditing) {
          setName("");
          setSelectedEventIds([]);
        }

        onCreated?.(savedSessions, payload.studentSessionUrl ?? null);
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });

        if (isEditing) {
          onCancelEdit?.();
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "세션을 저장하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">{isEditing ? "세션 수정" : "세션 생성"}</h2>
        <p className="mt-1 text-sm text-ink/70">
          {isEditing
            ? "이미 등록된 세션의 이름과 종목 구성을 수정합니다."
            : "단일 반 또는 2반 분할 세션을 바로 생성하고 열림 상태로 시작합니다."}
        </p>
      </div>
      {!sheetConnected ? (
        <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink/80">
          {sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요."}
        </div>
      ) : null}
      {isStructureLocked ? (
        <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink/80">
          이미 학생 기록이 있는 세션이라서 이름만 수정할 수 있습니다. 종목, 운영 방식, 반 구성은
          바꿀 수 없습니다.
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
            disabled={isStructureLocked}
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
            disabled={isStructureLocked}
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
            disabled={isStructureLocked}
          >
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.label} ({classroom.gradeLevel}학년)
              </option>
            ))}
          </select>
        </label>
        {classScope === "split" ? (
          <label className="flex flex-col gap-2 text-sm">
            보조 반
            <select
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={secondaryClassId}
              onChange={(event) => setSecondaryClassId(event.target.value)}
              disabled={isStructureLocked}
            >
              {classes.map((classroom) => (
                <option key={classroom.id} value={classroom.id}>
                  {classroom.label} ({classroom.gradeLevel}학년)
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <fieldset className="rounded-2xl border border-ink/10 px-4 py-3 md:col-span-2">
          <legend className="px-1 text-sm font-medium">기록할 종목</legend>
          <p className="mt-2 text-sm text-ink/65">
            종목을 1개 이상 선택해주세요. 2개 이상 선택하면 하나의 세션 묶음으로 저장됩니다.
          </p>
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
                    disabled={isStructureLocked}
                    onChange={(event) => {
                      setSelectedEventIds((currentEventIds) =>
                        event.target.checked
                          ? [...currentEventIds, eventDefinition.id].filter(
                              (value, index, values) => values.indexOf(value) === index
                            )
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
      </div>
      {classScope === "split" ? (
        <p className="mt-3 text-sm text-ink/65">
          2반 분할은 학년과 무관하게 두 반을 선택하고, 선택한 모든 종목을 같은 반 조합으로 함께
          기록합니다.
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isEditing ? "세션 수정" : "세션 저장"}
        </button>
        {isEditing ? (
          <button
            type="button"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium"
            onClick={onCancelEdit}
            disabled={isPending}
          >
            수정 취소
          </button>
        ) : null}
        {feedback ? <p className="text-sm font-medium text-emerald-700">{feedback}</p> : null}
        {errorMessage ? <p className="text-sm font-medium text-rose-700">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
