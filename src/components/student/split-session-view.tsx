"use client";

import React, { useMemo, useState, useTransition } from "react";

import { InstantResultCard } from "./instant-result-card";
import { FourFactorProgressCard } from "./four-factor-progress-card";
import { NamePicker } from "./name-picker";
import { RecordForm, type RecordFormSubmission } from "./record-form";
import { StudentSessionNavigation } from "./student-session-navigation";
import type {
  BetterDirection,
  ClassScope,
  EventId,
  OfficialGrade,
  PAPSAttempt,
  PAPSStudentEventHistoryAttempt,
  SessionType
} from "../../lib/paps/types";
import type {
  FourFactorProgressView,
  FourFactorStudentResultView
} from "../four-factor-round-types";

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
  historyAttempts?: PAPSStudentEventHistoryAttempt[];
  latestOfficialGrade: OfficialGrade | null;
  roundProgress?: FourFactorProgressView | null;
  finalizedResult?: FourFactorStudentResultView | null;
};

const createClientSubmissionKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `submit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export function SplitSessionView({
  sessionGroupId,
  sessionId,
  studentAccessToken,
  sessionType,
  classScope,
  eventId,
  eventLabel,
  unit,
  betterDirection,
  measurementConstraints,
  classSections,
  teacherReturnEnabled = false,
  assessmentProgress = null,
  onNextMeasurement,
  onAssessmentProgressChange,
  assessmentProgressResetKey = 0,
  onStudentChange
}: {
  sessionGroupId?: string | null;
  sessionId: string;
  studentAccessToken?: string | null;
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
  teacherReturnEnabled?: boolean;
  assessmentProgress?: FourFactorProgressView | null;
  onNextMeasurement?: (factorId: FourFactorProgressView["factors"][number]["factorId"]) => void;
  onAssessmentProgressChange?: (progress: FourFactorProgressView | null) => void;
  assessmentProgressResetKey?: number;
  onStudentChange?: (studentId: string) => void;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmissionResult | null>(null);
  const [editingAttempt, setEditingAttempt] = useState<PAPSAttempt | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roundProgress, setRoundProgress] = useState<FourFactorProgressView | null>(assessmentProgress);
  const [finalizedResult, setFinalizedResult] = useState<FourFactorStudentResultView | null>(null);
  const studentStatusRequestRef = React.useRef(0);
  const assessmentProgressRef = React.useRef(assessmentProgress);
  assessmentProgressRef.current = assessmentProgress;
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
  // A new reset key means a different student; progress updates for the same
  // student intentionally do not clear the local finalized state.
  React.useEffect(() => {
    setRoundProgress(assessmentProgressRef.current);
    setFinalizedResult(null);
    setSubmitResult(null);
    setEditingAttempt(null);
  }, [assessmentProgressResetKey]);
  const editingInitialSubmission = useMemo(
    () =>
      editingAttempt
        ? {
            measurement: editingAttempt.measurement,
            detail: editingAttempt.detail ?? null
          }
        : null,
    [editingAttempt]
  );

  const handleSelectStudent = (studentId: string) => {
    if (isPending && !submitResult) {
      return;
    }

    setSelectedStudentId(studentId);
    onStudentChange?.(studentId);
    setSubmitResult(null);
    setEditingAttempt(null);
    setErrorMessage(null);
    setFinalizedResult(null);

    if (!assessmentProgress || !sessionGroupId || !studentAccessToken) {
      return;
    }

    const requestId = studentStatusRequestRef.current + 1;
    studentStatusRequestRef.current = requestId;

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/session-groups/${encodeURIComponent(sessionGroupId)}/students/${encodeURIComponent(studentId)}/round-status`,
          {
            method: "GET",
            headers: {
              "x-paps-student-access-token": studentAccessToken
            },
            cache: "no-store"
          }
        );
        const payload = (await response.json()) as {
          error?: string;
          result?: {
            roundProgress: FourFactorProgressView;
            finalizedResult?: FourFactorStudentResultView | null;
          };
        };

        if (!response.ok || !payload.result) {
          throw new Error(payload.error ?? "회차 진행 상태를 불러오지 못했습니다.");
        }

        if (studentStatusRequestRef.current !== requestId) {
          return;
        }

        setRoundProgress(payload.result.roundProgress);
        onAssessmentProgressChange?.(payload.result.roundProgress);
        setFinalizedResult(payload.result.finalizedResult ?? null);
      } catch (error) {
        if (studentStatusRequestRef.current === requestId) {
          setErrorMessage(
            error instanceof Error ? error.message : "회차 진행 상태를 불러오지 못했습니다."
          );
        }
      }
    });
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
              clientSubmissionKey,
              accessToken: studentAccessToken ?? undefined
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
          const nextRoundProgress = payload.result.roundProgress ?? roundProgress;
          setRoundProgress(nextRoundProgress);
          onAssessmentProgressChange?.(nextRoundProgress);
          setFinalizedResult(payload.result.finalizedResult ?? null);
          setEditingAttempt(null);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "기록을 제출하지 못했습니다.");
        } finally {
          resolve();
        }
      });
    });
  };

  const handleUpdateLatestAttempt = async (submission: RecordFormSubmission) => {
    if (!selectedStudentId || !editingAttempt) {
      return;
    }

    setErrorMessage(null);

    await new Promise<void>((resolve) => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/sessions/${sessionId}/submit`, {
            method: "PATCH",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              studentId: selectedStudentId,
              attemptId: editingAttempt.id,
              measurement: submission.measurement,
              detail: submission.detail ?? null,
              clientSubmissionKey: editingAttempt.clientSubmissionKey,
              accessToken: studentAccessToken ?? undefined
            })
          });
          const payload = (await response.json()) as {
            error?: string;
            result?: SubmissionResult;
          };

          if (!response.ok || !payload.result) {
            throw new Error(payload.error ?? "기록을 수정하지 못했습니다.");
          }

          setSubmitResult(payload.result);
          const nextRoundProgress = payload.result.roundProgress ?? roundProgress;
          setRoundProgress(nextRoundProgress);
          onAssessmentProgressChange?.(nextRoundProgress);
          setFinalizedResult(payload.result.finalizedResult ?? null);
          setEditingAttempt(null);
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : "기록을 수정하지 못했습니다.");
        } finally {
          resolve();
        }
      });
    });
  };

  const handleReset = () => {
    studentStatusRequestRef.current += 1;
    setSelectedStudentId(null);
    setSubmitResult(null);
    setEditingAttempt(null);
    setErrorMessage(null);
    setFinalizedResult(null);
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
              disabled={isPending && !submitResult}
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

      {roundProgress ? (
        <FourFactorProgressCard
          progress={roundProgress}
          finalizedResult={finalizedResult}
          onNextMeasurement={onNextMeasurement}
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
            historyAttempts={roundProgress ? undefined : submitResult.historyAttempts}
            betterDirection={betterDirection}
            latestOfficialGrade={submitResult.latestOfficialGrade}
            onEditLatestAttempt={(attempt) => {
              setEditingAttempt(attempt);
              setErrorMessage(null);
            }}
          />
          {editingAttempt ? (
            <RecordForm
              studentId={submitResult.student.id}
              eventId={eventId}
              studentName={`${submitResult.student.name} 기록 수정`}
              eventLabel={eventLabel}
              unit={unit}
              measurementConstraints={measurementConstraints}
              isSubmitting={isPending}
              errorMessage={errorMessage}
              initialSubmission={editingInitialSubmission}
              submitLabel="수정 저장"
              description="방금 입력한 기록을 고쳐 저장합니다. 저장하면 같은 회차 기록이 수정됩니다."
              onCancel={() => {
                setEditingAttempt(null);
                setErrorMessage(null);
              }}
              onSubmit={handleUpdateLatestAttempt}
            />
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <StudentSessionNavigation
              teacherReturnEnabled={teacherReturnEnabled}
              studentAccessToken={studentAccessToken}
            />
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
