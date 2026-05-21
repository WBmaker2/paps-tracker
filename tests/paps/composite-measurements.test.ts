import { describe, expect, it } from "vitest";

import {
  deriveCompositeMeasurement,
  formatAttemptDetailSummary,
  isGripStrengthMeasurementDetail,
  parseMeasurementDetail,
  resolveSubmissionMeasurement
} from "../../src/lib/paps/composite-measurements";

describe("PAPS composite measurements", () => {
  it("derives step-test PEI from three recovery heart rates and rounds up to one decimal place", () => {
    expect(
      deriveCompositeMeasurement({
        eventId: "step-test",
        detail: {
          kind: "step-test",
          recoveryHeartRates: [50, 50, 49]
        }
      })
    ).toMatchObject({
      measurement: 60.5
    });
  });

  it("derives comprehensive flexibility score from four right-left sections", () => {
    expect(
      deriveCompositeMeasurement({
        eventId: "comprehensive-flexibility",
        detail: {
          kind: "comprehensive-flexibility",
          shoulder: {
            right: true,
            left: true
          },
          trunk: {
            right: true,
            left: false
          },
          side: {
            right: false,
            left: false
          },
          lowerBody: {
            right: true,
            left: true
          }
        }
      })
    ).toMatchObject({
      measurement: 5
    });
  });

  it("formats composite attempt details for instant student feedback", () => {
    expect(
      formatAttemptDetailSummary({
        eventId: "step-test",
        detail: {
          kind: "step-test",
          recoveryHeartRates: [48, 50, 52]
        }
      })
    ).toBe("회복심박수 48 / 50 / 52회");

    expect(
      formatAttemptDetailSummary({
        eventId: "comprehensive-flexibility",
        detail: {
          kind: "comprehensive-flexibility",
          shoulder: {
            right: true,
            left: true
          },
          trunk: {
            right: true,
            left: false
          },
          side: {
            right: false,
            left: false
          },
          lowerBody: {
            right: true,
            left: true
          }
        }
      })
    ).toBe("어깨 2점 · 몸통 1점 · 옆구리 0점 · 하체 2점");
  });

  it("parses grip-strength detail and preserves right/left values", () => {
    const detail = {
      kind: "grip-strength",
      right: 18,
      left: 17.4
    };

    expect(parseMeasurementDetail(detail)).toEqual(detail);
  });

  it("rejects invalid grip-strength detail during parsing", () => {
    expect(parseMeasurementDetail({ kind: "grip-strength", left: 12 })).toBeNull();
    expect(parseMeasurementDetail({ kind: "grip-strength", right: -2, left: 12 })).toBeNull();
    expect(parseMeasurementDetail({ kind: "grip-strength", right: 201, left: 12 })).toBeNull();
    expect(parseMeasurementDetail({ kind: "grip-strength", right: Number.NaN, left: 12 })).toBeNull();
    expect(parseMeasurementDetail({ kind: "grip-strength", right: Infinity, left: 12 })).toBeNull();
  });

  it("resolves grip-strength submission measurement from right/left values", () => {
    expect(
      resolveSubmissionMeasurement({
        eventId: "grip-strength",
        detail: {
          kind: "grip-strength",
          right: 15.2,
          left: 17.4
        }
      })
    ).toMatchObject({
      measurement: 17.4,
      detail: {
        kind: "grip-strength",
        right: 15.2,
        left: 17.4
      }
    });
  });

  it("requires valid grip-strength detail to resolve submission", () => {
    expect(() =>
      resolveSubmissionMeasurement({
        eventId: "grip-strength",
        measurement: 30,
        detail: null
      })
    ).toThrow("악력 세부 기록을 입력해 주세요.");
  });

  it("formats grip-strength detail summary in Korean", () => {
    expect(
      formatAttemptDetailSummary({
        eventId: "grip-strength",
        detail: {
          kind: "grip-strength",
          right: 18,
          left: 17.4
        }
      })
    ).toBe("오른쪽 18kg · 왼쪽 17.4kg");
  });

  it("isGripStrengthMeasurementDetail validates grip details", () => {
    expect(
      isGripStrengthMeasurementDetail({
        kind: "grip-strength",
        right: 18,
        left: 17
      })
    ).toBe(true);

    expect(isGripStrengthMeasurementDetail({ kind: "grip-strength", right: -1, left: 17 })).toBe(false);
    expect(isGripStrengthMeasurementDetail({ kind: "grip-strength", right: "18", left: 17 })).toBe(false);
    expect(isGripStrengthMeasurementDetail({ kind: "grip-strength", right: 18, left: NaN })).toBe(false);
  });
});
