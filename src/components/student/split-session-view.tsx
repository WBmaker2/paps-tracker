"use client";

import React, { useMemo, useState, useTransition } from "react";

import { InstantResultCard } from "./instant-result-card";
import { NamePicker } from "./name-picker";
import { RecordForm, type RecordFormSubmission } from "./record-form";
import type {
  BetterDirection,
  ClassScope,
  EventId,
  OfficialGrade,
  PAPSAttempt,
  SessionType
} from "../../lib/paps/types";

type ClassSection = {
  classId: string;
  label: string;
  students: Array<{
    id: string;
    name: string;
  }>;
};

type SubmissionResult = {
  student: {
    id: string;
    name: string;
  };
  attempts: PAPSAttempt[];
  latestOfficialGrade: OfficialGrade | null;
};

const createClientSubmissionKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `submit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function SplitSessionView({
  sessionId,
  sessionType,
  classScope,
  eventId,
  eventLabel,
  unit,
  betterDirection,
  measurementConstraints,
  classSections
}: {
  sessionId: string;
  sessionType: SessionType;
  classScope: ClassScope;
  eventId: EventId;
  eventLabel: string;
  unit: string;
  betterDirection: BetterDirection;
  measurementConstraints: {
    min: number;
    max: number;
    precision: number;
  };
  classSections: ClassSection[];
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const studentLookup = useMemo(
    () =>
      new Map(
        classSections.flatMap((classSection) =>
          classSection.students.map((student) => [student.id, student] as const)
        )
      ),
    [classSections]
  );
  const selectedStudent =
    (selectedStudentId ? studentLookup.get(selectedStudentId) ?? null : null) ??
    submitResult?.student ??
    null;

  const handleSelectStudent = (studentId: string) => {
    if (submitResult) {
      return;
    }

    setSelectedStudentId(studentId);
    setErrorMessage(null);
  };

  const handleSubmit = async (submission: RecordFormSubmission) => {
    if (!selectedStudentId) {
      return;
    }

    setErrorMessage(null);
    const clientSubmissionKey = createClientSubmissionKey();

    await new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/sessions/${sessionId}/submit`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              studentId: selectedStudentId,
              measurement: submission.measurement,
              detail: submission.detail ?? null,
              clientSubmissionKey
            })
          });
          const payload = (await response.json()) as {
            error?: string;
            result?: SubmissionResult;
          };

          if (!response.ok || !payload.result) {
            throw new Error(payload.error ?? "기록을 제출하지 못했습니다.");
          }

          setSubmitResult(payload.result);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "기록을 제출하지 못했습니다.");
        } finally {
          resolve();
        }
      });
    });
  };

  const handleReset = () => {
    setSelectedStudentId(null);
    setSubmitResult(null);
    setErrorMessage(null);
  };

  return (
    <div className="grid gap-6">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">이름을 선택하세요</h2>
          <p className="mt-1 text-sm text-ink/70">
            {classScope === "split"
              ? "반별 이름판에서 본인 이름을 선택합니다."
              : "이름을 선택하면 바로 기록 입력 칸이 열립니다."}
          </p>
        </div>
        <div className={`grid gap-4 ${classScope === "split" ? "md:grid-cols-2" : ""}`}>
          {classSections.map((classSection) => (
            <NamePicker
              key={classSection.classId}
              title={classScope === "split" ? `${classSection.label} 반` : "학생 목록"}
              students={classSection.students}
              selectedStudentId={selectedStudentId}
              disabled={submitResult !== null}
              onSelect={handleSelectStudent}
            />
          ))}
        </div>
      </section>

      {selectedStudent && !submitResult ? (
        <RecordForm
          studentId={selectedStudent.id}
          eventId={eventId}
          studentName={selectedStudent.name}
          eventLabel={eventLabel}
          unit={unit}
          measurementConstraints={measurementConstraints}
          isSubmitting={isPending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
        />
      ) : null}

      {submitResult ? (
        <div className="grid gap-4">
          <InstantResultCard
            studentName={submitResult.student.name}
            sessionType={sessionType}
            eventId={eventId}
            eventLabel={eventLabel}
            unit={unit}
            attempts={submitResult.attempts}
            betterDirection={betterDirection}
            latestOfficialGrade={submitResult.latestOfficialGrade}
          />
          <div className="flex justify-end">
            <button
              type="button"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent"
              onClick={handleReset}
            >
              다음 학생
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
