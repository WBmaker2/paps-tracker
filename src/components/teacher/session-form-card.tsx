"use client";
import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { getEligibleEventDefinitions, getSessionTypeEventDefinitions } from "../../lib/paps/catalog";
import type { EventId, PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import {
  FOUR_FACTOR_IDS,
  FOUR_FACTOR_LABELS,
  type FourFactorId
} from "../four-factor-round-types";
import { createAssessmentRoundIdempotencyKey, FourFactorRoundOptions } from "./four-factor-round-creation-fields";
import { EventSessionFields, SessionCreationModeFieldset } from "./session-form-mode-fields";
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
  const [creationMode, setCreationMode] = useState<"event" | "four-factor">("event");
  const [sessionType, setSessionType] = useState<"official" | "practice">("practice");
  const [classScope, setClassScope] = useState<"single" | "split">("single");
  const [primaryClassId, setPrimaryClassId] = useState(classes[0]?.id ?? "");
  const [secondaryClassId, setSecondaryClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const [selectedEventIds, setSelectedEventIds] = useState<EventId[]>([]);
  const [selectedEventsByFactor, setSelectedEventsByFactor] = useState<
    Partial<Record<FourFactorId, EventId>>
  >({});
  const [roundType, setRoundType] = useState<"regular" | "followUp">("regular");
  const [roundNumber, setRoundNumber] = useState(1);
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
  const fourFactorEvents = useMemo(() => {
    const eligibleEvents = (() => {
      if (classScope !== "split") {
        return getEligibleEventDefinitions({
          gradeLevel: primaryClass?.gradeLevel ?? 5,
          sessionType: "official"
        });
      }

      const secondaryClass = classes.find((classroom) => classroom.id === secondaryClassId);
      const primaryEligible = getEligibleEventDefinitions({
        gradeLevel: primaryClass?.gradeLevel ?? 5,
        sessionType: "official"
      });
      const secondaryEligible = getEligibleEventDefinitions({
        gradeLevel: secondaryClass?.gradeLevel ?? primaryClass?.gradeLevel ?? 5,
        sessionType: "official"
      });
      const secondaryIds = new Set(secondaryEligible.map((event) => event.id));

      return primaryEligible.filter((event) => secondaryIds.has(event.id));
    })();

    return FOUR_FACTOR_IDS.reduce<Record<FourFactorId, typeof eligibleEvents>>(
      (groups, factorId) => {
        groups[factorId] = eligibleEvents.filter((event) => event.factorId === factorId);
        return groups;
      },
      {
        "cardiorespiratory-endurance": [],
        flexibility: [],
        "strength-endurance": [],
        power: []
      }
    );
  }, [classScope, classes, primaryClass?.gradeLevel, secondaryClassId]);

  useEffect(() => {
    const eligibleEventIds = new Set(eligibleEvents.map((eventDefinition) => eventDefinition.id));
    const nextEventIds = selectedEventIds.filter((eventId) => eligibleEventIds.has(eventId));

    if (!arraysEqual(selectedEventIds, nextEventIds)) {
      setSelectedEventIds(nextEventIds);
    }
  }, [eligibleEvents, selectedEventIds]);

  useEffect(() => {
    const eligibleByFactor = new Map(
      FOUR_FACTOR_IDS.map((factorId) => [
        factorId,
        new Set(fourFactorEvents[factorId].map((eventDefinition) => eventDefinition.id))
      ])
    );
    setSelectedEventsByFactor((current) => {
      const next = { ...current };
      let changed = false;

      FOUR_FACTOR_IDS.forEach((factorId) => {
        const selected = current[factorId];
        if (selected && !eligibleByFactor.get(factorId)?.has(selected)) {
          delete next[factorId];
          changed = true;
        }
      });

      return changed ? next : current;
    });
  }, [fourFactorEvents]);

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
      setCreationMode("event");
      setSessionType(editingSession.sessionType);
      setClassScope(editingSession.classScope);
      setPrimaryClassId(editingSession.primaryClassId || (classes[0]?.id ?? ""));
      setSecondaryClassId(
        editingSession.secondaryClassId || classes[1]?.id || classes[0]?.id || ""
      );
      setSelectedEventIds(editingSession.eventIds);
      setSelectedEventsByFactor({});
      return;
    }

    setName("");
    setCreationMode("event");
    setSessionType("practice");
    setClassScope("single");
    setPrimaryClassId(classes[0]?.id ?? "");
    setSecondaryClassId(classes[1]?.id ?? classes[0]?.id ?? "");
    setSelectedEventIds([]);
    setSelectedEventsByFactor({});
    setRoundType("regular");
    setRoundNumber(1);
  }, [editingSession, classes]);

  useEffect(() => {
    if (creationMode === "four-factor") {
      setSessionType("official");
    }
  }, [creationMode]);

  const handleSubmit = () => {
    if (!sheetConnected) {
      setFeedback(null);
      setErrorMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    setFeedback(null);
    setErrorMessage(null);

    if (creationMode === "four-factor") {
      const missingFactors = FOUR_FACTOR_IDS.filter((factorId) => !selectedEventsByFactor[factorId]);

      if (missingFactors.length > 0) {
        setErrorMessage(`네 요인의 종목을 모두 선택해주세요: ${missingFactors.map((factorId) => FOUR_FACTOR_LABELS[factorId]).join(", ")}`);
        return;
      }

      startTransition(async () => {
        try {
          const response = await fetch("/api/assessment-rounds", {
            method: "POST",
            headers: buildTeacherMutationHeaders({
              "content-type": "application/json",
              "Idempotency-Key": createAssessmentRoundIdempotencyKey()
            }),
            body: JSON.stringify({
              name,
              academicYear: new Date().getFullYear(),
              roundType,
              roundNumber,
              classTargets: [
                { classId: primaryClassId },
                ...(classScope === "split" && secondaryClassId !== primaryClassId
                  ? [{ classId: secondaryClassId }]
                  : [])
              ],
              selectedEventsByFactor,
              sessionType: "official",
              openImmediately: true
            })
          });
          const payload = (await response.json()) as {
            error?: string | { message?: string };
            sessions?: PAPSSession[];
            session?: PAPSSession;
            studentSessionUrl?: string | null;
            teacherStateVersion?: string;
          };
          const savedSessions = payload.sessions ?? (payload.session ? [payload.session] : []);
          const error = typeof payload.error === "string" ? payload.error : payload.error?.message;

          if (!response.ok || savedSessions.length === 0) {
            throw new Error(error ?? "4요인 평가 회차를 저장하지 못했습니다.");
          }

          setFeedback("4요인 평가 회차를 저장했습니다.");
          setName("");
          setSelectedEventsByFactor({});
          onCreated?.(savedSessions, payload.studentSessionUrl ?? null);
          notifyTeacherDataRefresh({ refresh: false, nextVersion: payload.teacherStateVersion ?? null });
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "4요인 평가 회차를 저장하지 못했습니다.");
        }
      });
      return;
    }

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
      <SessionCreationModeFieldset value={creationMode} disabled={isStructureLocked || isEditing} onChange={setCreationMode} />
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
            disabled={isStructureLocked || creationMode === "four-factor"}
          >
            <option value="official">공식</option>
            <option value="practice">연습</option>
          </select>
        </label>
        {creationMode === "four-factor" ? (
          <FourFactorRoundOptions
            roundType={roundType}
            onRoundTypeChange={setRoundType}
            roundNumber={roundNumber}
            onRoundNumberChange={setRoundNumber}
            eventsByFactor={fourFactorEvents}
            selectedEventsByFactor={selectedEventsByFactor}
            onEventChange={(factorId, eventId) => setSelectedEventsByFactor((current) => ({ ...current, [factorId]: eventId as EventId }))}
          />
        ) : null}
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
        {creationMode === "four-factor" ? null : <EventSessionFields events={eligibleEvents} selectedEventIds={selectedEventIds} disabled={isStructureLocked} onToggle={(eventId, checked) => setSelectedEventIds((current) => checked ? [...current, eventId].filter((value, index, values) => values.indexOf(value) === index) : current.filter((entry) => entry !== eventId))} />}
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
          className={`rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 ${creationMode === "four-factor" ? "gi-pulse" : ""}`}
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isEditing ? "세션 수정" : creationMode === "four-factor" ? "4요인 평가 회차 저장" : "세션 저장"}
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
