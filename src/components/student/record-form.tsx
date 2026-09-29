"use client";

import React, { useEffect, useRef, useState } from "react";
import type { EventId } from "../../lib/paps/types";
import {
  buildFlexibilityDetail,
  createEmptyFlexibilityState,
  createFlexibilityStateFromDetail,
  FLEXIBILITY_SECTION_LABELS,
  STEP_TEST_INPUT_LABELS,
  type FlexibilityFormState,
  type RecordFormSubmission
} from "./record-form-state";
import { formatStudentUnit } from "../../lib/paps/student-measurement-display";

export function RecordForm({
  studentId,
  eventId,
  studentName,
  eventLabel,
  unit,
  measurementConstraints,
  isSubmitting,
  errorMessage,
  initialSubmission = null,
  submitLabel = "기록 제출",
  description,
  autoFocusFirstField = false,
  onCancel,
  onClearError,
  onSubmit
}: {
  studentId: string;
  eventId: EventId;
  studentName: string;
  eventLabel: string;
  unit: string;
  measurementConstraints: {
    min: number;
    max: number;
    precision: number;
  };
  isSubmitting: boolean;
  errorMessage: string | null;
  initialSubmission?: RecordFormSubmission | null;
  submitLabel?: string;
  description?: string;
  autoFocusFirstField?: boolean;
  onCancel?: () => void;
  onClearError?: () => void;
  onSubmit: (submission: RecordFormSubmission) => Promise<void> | void;
}) {
  const [measurement, setMeasurement] = useState("");
  const [stepHeartRates, setStepHeartRates] = useState(["", "", ""]);
  const [flexibilityState, setFlexibilityState] = useState<FlexibilityFormState>(
    createEmptyFlexibilityState()
  );
  const [gripRight, setGripRight] = useState("");
  const [gripLeft, setGripLeft] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const errorId = `${studentId}-record-error`;
  const visibleError = localError ?? errorMessage;

  const showFieldError = (message: string, field: string) => {
    setLocalError(message);
    setErrorField(field);
    requestAnimationFrame(() => inputRefs.current.get(field)?.focus());
  };

  const setInputRef = (field: string) => (node: HTMLInputElement | null) => {
    if (node) inputRefs.current.set(field, node);
    else inputRefs.current.delete(field);
  };

  const clearFieldError = () => {
    setLocalError(null);
    setErrorField(null);
    onClearError?.();
  };

  useEffect(() => {
    if (!autoFocusFirstField) return;
    requestAnimationFrame(() => {
      const firstInput = inputRefs.current.values().next().value as HTMLInputElement | undefined;
      if (!firstInput) return;
      const section = sectionRef.current;
      if (typeof section?.scrollIntoView === "function") {
        section.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      firstInput.focus({ preventScroll: true });
    });
  }, [autoFocusFirstField, eventId, studentId]);

  useEffect(() => {
    if (!errorMessage || localError) return;
    const fallbackField = eventId === "step-test" ? "step-0" : eventId === "grip-strength" ? "grip-right" : eventId === "comprehensive-flexibility" ? "flex-shoulder-right" : "measurement";
    setErrorField(fallbackField);
    requestAnimationFrame(() => inputRefs.current.get(fallbackField)?.focus());
  }, [errorMessage, eventId, localError]);

  useEffect(() => {
    if (eventId === "grip-strength") {
      setGripRight(
        initialSubmission?.detail?.kind === "grip-strength" ? String(initialSubmission.detail.right) : ""
      );
      setGripLeft(
        initialSubmission?.detail?.kind === "grip-strength" ? String(initialSubmission.detail.left) : ""
      );
      setMeasurement("");
    } else {
      setMeasurement(
        initialSubmission?.measurement !== undefined ? String(initialSubmission.measurement) : ""
      );
    }

    setStepHeartRates(
      initialSubmission?.detail?.kind === "step-test"
        ? initialSubmission.detail.recoveryHeartRates.map((value) => String(value))
        : ["", "", ""]
    );
    setFlexibilityState(createFlexibilityStateFromDetail(initialSubmission?.detail));
    setLocalError(null);
  }, [eventId, initialSubmission, studentId]);

  const step = measurementConstraints.precision === 0 ? "1" : `0.${"0".repeat(Math.max(0, measurementConstraints.precision - 1))}1`;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (eventId === "step-test") {
      const parsedHeartRates = stepHeartRates.map((value) => {
        if (!value.trim()) {
          return null;
        }

        const numericValue = Number(value);

        if (!Number.isInteger(numericValue) || numericValue < 0 || numericValue > 240) {
          return Number.NaN;
        }

        return numericValue;
      });

      if (parsedHeartRates.some((value) => value === null)) {
        const missingIndex = parsedHeartRates.findIndex((value) => value === null);
        showFieldError("심박수 3개를 모두 입력해 주세요.", `step-${missingIndex}`);
        return;
      }

      if (parsedHeartRates.some((value) => Number.isNaN(value))) {
        const invalidIndex = parsedHeartRates.findIndex((value) => Number.isNaN(value));
        showFieldError("심박수는 0~240 사이 정수로 입력해 주세요.", `step-${invalidIndex}`);
        return;
      }

      setLocalError(null);
      await onSubmit({
        detail: {
          kind: "step-test",
          recoveryHeartRates: parsedHeartRates as [number, number, number]
        }
      });
      return;
    }

    if (eventId === "comprehensive-flexibility") {
      const detail = buildFlexibilityDetail(flexibilityState);

      if (!detail) {
        const missingSection = FLEXIBILITY_SECTION_LABELS.find((section) =>
          (["right", "left"] as const).some((side) => flexibilityState[section.key][side] === null)
        );
        const missingSide = missingSection
          ? (["right", "left"] as const).find((side) => flexibilityState[missingSection.key][side] === null)
          : "right";
        showFieldError("종합유연성의 모든 항목을 선택해 주세요.", `flex-${missingSection?.key ?? "shoulder"}-${missingSide ?? "right"}`);
        return;
      }

      setLocalError(null);
      await onSubmit({
        detail
      });
      return;
    }

    if (eventId === "grip-strength") {
      if (!gripRight.trim() || !gripLeft.trim()) {
        showFieldError("양쪽 악력 값을 모두 입력해 주세요.", gripRight.trim() ? "grip-left" : "grip-right");
        return;
      }

      const rightMeasurement = Number(gripRight);
      const leftMeasurement = Number(gripLeft);

      if (!Number.isFinite(rightMeasurement) || !Number.isFinite(leftMeasurement)) {
        showFieldError("악력은 숫자로 입력해 주세요.", Number.isFinite(rightMeasurement) ? "grip-left" : "grip-right");
        return;
      }

      const gripValues = [
        { value: rightMeasurement, field: "grip-right", side: "오른쪽" },
        { value: leftMeasurement, field: "grip-left", side: "왼쪽" }
      ];
      const invalidGrip = gripValues.find(({ value }) =>
        value < measurementConstraints.min || value > measurementConstraints.max
      );
      if (invalidGrip) {
        showFieldError(
          `${invalidGrip.side} 악력은 ${measurementConstraints.min}~${measurementConstraints.max} ${formatStudentUnit(unit)} 사이로 입력해 주세요.`,
          invalidGrip.field
        );
        return;
      }
      const precisionFactor = 10 ** measurementConstraints.precision;
      const invalidPrecisionGrip = gripValues.find(({ value }) =>
        Math.abs(value * precisionFactor - Math.round(value * precisionFactor)) > Number.EPSILON * 10
      );
      if (invalidPrecisionGrip) {
        showFieldError(
          `${invalidPrecisionGrip.side} 악력은 소수점 아래 ${measurementConstraints.precision}자리까지 입력해 주세요.`,
          invalidPrecisionGrip.field
        );
        return;
      }

      setLocalError(null);
      await onSubmit({
        detail: {
          kind: "grip-strength",
          right: rightMeasurement,
          left: leftMeasurement
        }
      });
      return;
    }

    if (!measurement.trim()) {
      showFieldError("숫자 기록을 입력해 주세요.", "measurement");
      return;
    }

    const numericMeasurement = Number(measurement);

    if (!Number.isFinite(numericMeasurement)) {
      showFieldError("숫자 기록을 입력해 주세요.", "measurement");
      return;
    }

    if (numericMeasurement < measurementConstraints.min || numericMeasurement > measurementConstraints.max) {
      showFieldError(`기록은 ${measurementConstraints.min}~${measurementConstraints.max} ${formatStudentUnit(unit)} 사이로 입력해 주세요.`, "measurement");
      return;
    }

    const precisionFactor = 10 ** measurementConstraints.precision;
    if (Math.abs(numericMeasurement * precisionFactor - Math.round(numericMeasurement * precisionFactor)) > Number.EPSILON * 10) {
      showFieldError(`소수점 아래 ${measurementConstraints.precision}자리까지 입력해 주세요.`, "measurement");
      return;
    }

    setLocalError(null);
    await onSubmit({
      measurement: numericMeasurement
    });
  };

  return (
    <section ref={sectionRef} className="scroll-mt-4 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{studentName}</h2>
        <p className="mt-1 text-sm text-ink/70">
          {description ?? `${eventLabel} 기록을 입력하고 바로 제출합니다.`}
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        {eventId === "step-test" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {STEP_TEST_INPUT_LABELS.map((label, index) => (
                <label key={label} className="flex flex-col gap-2 text-sm">
                  {label}
                  <input
                    ref={setInputRef(`step-${index}`)}
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={0}
                    max={240}
                    className="rounded-2xl border border-ink/15 px-4 py-3"
                    value={stepHeartRates[index]}
                    aria-invalid={errorField === `step-${index}` && Boolean(visibleError)}
                    aria-describedby={errorField === `step-${index}` && visibleError ? errorId : undefined}
                    onChange={(inputEvent) => {
                      clearFieldError();
                      setStepHeartRates((current) => {
                        const next = [...current];
                        next[index] = inputEvent.target.value;
                        return next;
                      });
                    }}
                  />
                </label>
              ))}
            </div>
            <p className="text-sm text-ink/70">
              세 구간 심박수로 심폐지구력 지수를 계산해요. 심박수는 분당 횟수로 입력합니다.
            </p>
          </>
        ) : null}

        {eventId === "comprehensive-flexibility" ? (
          <>
            <div className="grid gap-4">
              {FLEXIBILITY_SECTION_LABELS.map((section) => (
                <fieldset
                  key={section.key}
                  className="rounded-2xl border border-ink/10 bg-canvas/70 p-4"
                >
                  <legend className="px-1 text-sm font-semibold text-ink">{section.label}</legend>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    {(["right", "left"] as const).map((side) => {
                      const sideLabel = side === "right" ? "오른쪽" : "왼쪽";
                      const groupName = `${section.key}-${side}`;
                      const currentValue = flexibilityState[section.key][side];
                      const successId = `${studentId}-${groupName}-success`;
                      const failId = `${studentId}-${groupName}-fail`;

                      return (
                        <div key={groupName} className="rounded-2xl border border-ink/10 bg-white p-3">
                          <p className="mb-3 text-sm font-medium text-ink">
                            {section.label} {sideLabel}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <div className="flex items-center gap-2">
                              <input
                                ref={setInputRef(`flex-${groupName}`)}
                                id={successId}
                                type="radio"
                                name={groupName}
                                checked={currentValue === true}
                                aria-describedby={errorField === `flex-${groupName}` && visibleError ? errorId : undefined}
                                onChange={() => {
                                  clearFieldError();
                                  setFlexibilityState((current) => ({
                                    ...current,
                                    [section.key]: {
                                      ...current[section.key],
                                      [side]: true
                                    }
                                  }));
                                }}
                              />
                              <label htmlFor={successId} className="text-sm">
                                {section.label} {sideLabel} 성공
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                ref={setInputRef(`flex-${groupName}`)}
                                id={failId}
                                type="radio"
                                name={groupName}
                                checked={currentValue === false}
                                aria-describedby={errorField === `flex-${groupName}` && visibleError ? errorId : undefined}
                                onChange={() => {
                                  clearFieldError();
                                  setFlexibilityState((current) => ({
                                    ...current,
                                    [section.key]: {
                                      ...current[section.key],
                                      [side]: false
                                    }
                                  }));
                                }}
                              />
                              <label htmlFor={failId} className="text-sm">
                                {section.label} {sideLabel} 실패
                              </label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <p className="text-sm text-ink/70">
              각 부위의 좌우 성공 여부를 모두 선택하면 총점이 자동 계산됩니다.
            </p>
          </>
        ) : null}

        {eventId === "grip-strength" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm">
              오른쪽 악력
              <input
                ref={setInputRef("grip-right")}
                type="number"
                inputMode="decimal"
                step={step}
                min={measurementConstraints.min}
                max={measurementConstraints.max}
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={gripRight}
                aria-invalid={errorField === "grip-right" && Boolean(visibleError)}
                aria-describedby={errorField === "grip-right" && visibleError ? errorId : undefined}
                onChange={(inputEvent) => { clearFieldError(); setGripRight(inputEvent.target.value); }}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              왼쪽 악력
              <input
                ref={setInputRef("grip-left")}
                type="number"
                inputMode="decimal"
                step={step}
                min={measurementConstraints.min}
                max={measurementConstraints.max}
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={gripLeft}
                aria-invalid={errorField === "grip-left" && Boolean(visibleError)}
                aria-describedby={errorField === "grip-left" && visibleError ? errorId : undefined}
                onChange={(inputEvent) => { clearFieldError(); setGripLeft(inputEvent.target.value); }}
              />
            </label>
          </div>
        ) : null}
        {eventId !== "step-test" && eventId !== "comprehensive-flexibility" && eventId !== "grip-strength" ? (
          <>
            <label className="flex flex-col gap-2 text-sm">
              {eventLabel} 기록
              <input
                ref={setInputRef("measurement")}
                type="number"
                inputMode="decimal"
                step={step}
                min={measurementConstraints.min}
                max={measurementConstraints.max}
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={measurement}
                aria-invalid={errorField === "measurement" && Boolean(visibleError)}
                aria-describedby={errorField === "measurement" && visibleError ? errorId : undefined}
                onChange={(inputEvent) => { clearFieldError(); setMeasurement(inputEvent.target.value); }}
              />
            </label>
            <p className="text-sm text-ink/70">
              단위: {formatStudentUnit(unit)} · 입력 범위: {measurementConstraints.min}~{measurementConstraints.max}
            </p>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="gi-pulse min-h-12 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            {submitLabel}
          </button>
          {visibleError ? <p id={errorId} role="alert" className="text-sm font-medium text-rose-700">{visibleError}</p> : null}
          {onCancel ? (
            <button type="button" className="min-h-11 rounded-full border border-ink/15 px-5 py-3 text-sm font-medium text-ink transition hover:border-accent hover:text-accent" onClick={onCancel} disabled={isSubmitting}>수정 취소</button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export type { RecordFormSubmission };
