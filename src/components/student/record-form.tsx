"use client";

import React, { useEffect, useState } from "react";
import type {
  ComprehensiveFlexibilityMeasurementDetail,
  EventId,
  PAPSMeasurementDetail
} from "../../lib/paps/types";

type RecordFormSubmission = {
  measurement?: number;
  detail?: PAPSMeasurementDetail | null;
};

type FlexibilitySelection = boolean | null;

type FlexibilityFormState = {
  shoulder: {
    right: FlexibilitySelection;
    left: FlexibilitySelection;
  };
  trunk: {
    right: FlexibilitySelection;
    left: FlexibilitySelection;
  };
  side: {
    right: FlexibilitySelection;
    left: FlexibilitySelection;
  };
  lowerBody: {
    right: FlexibilitySelection;
    left: FlexibilitySelection;
  };
};

const STEP_TEST_INPUT_LABELS = [
  "심박수(1분~1분30초)",
  "심박수(2분~2분30초)",
  "심박수(3분~3분30초)"
] as const;

const FLEXIBILITY_SECTION_LABELS = [
  {
    key: "shoulder",
    label: "어깨"
  },
  {
    key: "trunk",
    label: "몸통"
  },
  {
    key: "side",
    label: "옆구리"
  },
  {
    key: "lowerBody",
    label: "하체"
  }
] as const;

const createEmptyFlexibilityState = (): FlexibilityFormState => ({
  shoulder: {
    right: null,
    left: null
  },
  trunk: {
    right: null,
    left: null
  },
  side: {
    right: null,
    left: null
  },
  lowerBody: {
    right: null,
    left: null
  }
});

const buildFlexibilityDetail = (
  value: FlexibilityFormState
): ComprehensiveFlexibilityMeasurementDetail | null => {
  const sections = Object.values(value).flatMap((section) => [section.right, section.left]);

  if (sections.some((entry) => entry === null)) {
    return null;
  }

  return {
    kind: "comprehensive-flexibility",
    shoulder: {
      right: value.shoulder.right ?? false,
      left: value.shoulder.left ?? false
    },
    trunk: {
      right: value.trunk.right ?? false,
      left: value.trunk.left ?? false
    },
    side: {
      right: value.side.right ?? false,
      left: value.side.left ?? false
    },
    lowerBody: {
      right: value.lowerBody.right ?? false,
      left: value.lowerBody.left ?? false
    }
  };
};

export function RecordForm({
  studentId,
  eventId,
  studentName,
  eventLabel,
  unit,
  measurementConstraints,
  isSubmitting,
  errorMessage,
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
  onSubmit: (submission: RecordFormSubmission) => Promise<void> | void;
}) {
  const [measurement, setMeasurement] = useState("");
  const [stepHeartRates, setStepHeartRates] = useState(["", "", ""]);
  const [flexibilityState, setFlexibilityState] = useState<FlexibilityFormState>(
    createEmptyFlexibilityState()
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setMeasurement("");
    setStepHeartRates(["", "", ""]);
    setFlexibilityState(createEmptyFlexibilityState());
    setLocalError(null);
  }, [studentId]);

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
        setLocalError("심박수 3개를 모두 입력해 주세요.");
        return;
      }

      if (parsedHeartRates.some((value) => Number.isNaN(value))) {
        setLocalError("심박수는 0~240 사이 정수로 입력해 주세요.");
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
        setLocalError("종합유연성의 모든 항목을 선택해 주세요.");
        return;
      }

      setLocalError(null);
      await onSubmit({
        detail
      });
      return;
    }

    if (!measurement.trim()) {
      setLocalError("숫자 기록을 입력해 주세요.");
      return;
    }

    const numericMeasurement = Number(measurement);

    if (!Number.isFinite(numericMeasurement)) {
      setLocalError("숫자 기록을 입력해 주세요.");
      return;
    }

    setLocalError(null);
    await onSubmit({
      measurement: numericMeasurement
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{studentName}</h2>
        <p className="mt-1 text-sm text-ink/70">
          {eventLabel} 기록을 입력하고 바로 제출합니다.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {eventId === "step-test" ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              {STEP_TEST_INPUT_LABELS.map((label, index) => (
                <label key={label} className="flex flex-col gap-2 text-sm">
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min={0}
                    max={240}
                    className="rounded-2xl border border-ink/15 px-4 py-3"
                    value={stepHeartRates[index]}
                    onChange={(inputEvent) => {
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
              단위: 회 · 세 구간 심박수를 입력하면 PEI가 자동 계산됩니다.
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
                                id={successId}
                                type="radio"
                                name={groupName}
                                checked={currentValue === true}
                                onChange={() => {
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
                                id={failId}
                                type="radio"
                                name={groupName}
                                checked={currentValue === false}
                                onChange={() => {
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

        {eventId !== "step-test" && eventId !== "comprehensive-flexibility" ? (
          <>
            <label className="flex flex-col gap-2 text-sm">
              {eventLabel} 기록
              <input
                type="number"
                inputMode="decimal"
                step={step}
                min={measurementConstraints.min}
                max={measurementConstraints.max}
                className="rounded-2xl border border-ink/15 px-4 py-3"
                value={measurement}
                onChange={(inputEvent) => setMeasurement(inputEvent.target.value)}
              />
            </label>
            <p className="text-sm text-ink/70">
              단위: {unit} · 입력 범위: {measurementConstraints.min}~{measurementConstraints.max}
            </p>
          </>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSubmitting}
          >
            기록 제출
          </button>
          {localError ? <p className="text-sm font-medium text-rose-700">{localError}</p> : null}
          {!localError && errorMessage ? (
            <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export type { RecordFormSubmission };
