import { describe, expect, it } from "vitest";

import {
  deriveCompositeMeasurement,
  formatAttemptDetailSummary
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
});
