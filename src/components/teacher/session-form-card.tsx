"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { getEligibleEventDefinitions } from "../../lib/paps/catalog";
import type { EventId, GradeLevel, PAPSClassroom, PAPSSession } from "../../lib/paps/types";
import { notifyTeacherDataRefresh } from "./teacher-data-refresh";

export interface SessionFormProps {
  classes: PAPSClassroom[];
  defaultTeacherId?: string;
  defaultSchoolId?: string;
  onCreated?: (session: PAPSSession, studentSessionUrl?: string | null) => void;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
}

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
  const [gradeLevel, setGradeLevel] = useState<GradeLevel>(5);
  const [sessionType, setSessionType] = useState<"official" | "practice">("practice");
  const [classScope, setClassScope] = useState<"single" | "split">("single");
  const [primaryClassId, setPrimaryClassId] = useState(classes[0]?.id ?? "");
  const [secondaryClassId, setSecondaryClassId] = useState(classes[1]?.id ?? classes[0]?.id ?? "");
  const eligibleEvents = useMemo(
    () => getEligibleEventDefinitions({ gradeLevel, sessionType }),
    [gradeLevel, sessionType]
  );
  const filteredClasses = useMemo(
    () => classes.filter((classroom) => classroom.gradeLevel === gradeLevel),
    [classes, gradeLevel]
  );
  const fallbackEventId = eligibleEvents[0]?.id ?? "shuttle-run";
  const [primaryEventId, setPrimaryEventId] = useState<EventId>(fallbackEventId);
  const [secondaryEventId, setSecondaryEventId] = useState<EventId>(fallbackEventId);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!eligibleEvents.some((eventDefinition) => eventDefinition.id === primaryEventId)) {
      setPrimaryEventId(fallbackEventId);
    }

    if (!eligibleEvents.some((eventDefinition) => eventDefinition.id === secondaryEventId)) {
      setSecondaryEventId(fallbackEventId);
    }
  }, [eligibleEvents, fallbackEventId, primaryEventId, secondaryEventId]);

  useEffect(() => {
    if (filteredClasses.length === 0) {
      return;
    }

    if (!filteredClasses.some((classroom) => classroom.id === primaryClassId)) {
      setPrimaryClassId(filteredClasses[0]!.id);
    }

    if (!filteredClasses.some((classroom) => classroom.id === secondaryClassId)) {
      setSecondaryClassId(filteredClasses[1]?.id ?? filteredClasses[0]!.id);
    }
  }, [filteredClasses, primaryClassId, secondaryClassId]);

  const handleSubmit = () => {
    if (!sheetConnected) {
      setFeedback(null);
      setErrorMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
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
            gradeLevel,
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
          studentSessionUrl?: string | null;
        };

        if (!response.ok || !payload.session) {
          throw new Error(payload.error ?? "세션을 저장하지 못했습니다.");
        }

        setFeedback("세션을 저장했습니다.");
        setName("");
        onCreated?.(payload.session, payload.studentSessionUrl ?? null);
        notifyTeacherDataRefresh();
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
          학년
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={gradeLevel}
            onChange={(event) => setGradeLevel(Number(event.target.value) as GradeLevel)}
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
            {filteredClasses.map((classroom) => (
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
            onChange={(event) => setPrimaryEventId(event.target.value as EventId)}
          >
            {eligibleEvents.map((eventDefinition) => (
              <option key={eventDefinition.id} value={eventDefinition.id}>
                {eventDefinition.label}
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
                {filteredClasses.map((classroom) => (
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
                onChange={(event) => setSecondaryEventId(event.target.value as EventId)}
              >
                {eligibleEvents.map((eventDefinition) => (
                  <option key={eventDefinition.id} value={eventDefinition.id}>
                    {eventDefinition.label}
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
