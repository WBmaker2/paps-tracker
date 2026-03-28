import { calculateOfficialGrade, validateOfficialGradeBands } from "../../src/lib/paps/grade";

describe("PAPS official grade rules", () => {
  it("computes official grades for shuttle-run because it is a supported official event", () => {
    expect(
      calculateOfficialGrade({
        gradeLevel: 4,
        sex: "male",
        eventId: "shuttle-run",
        measurement: 96
      })
    ).toBe(1);

    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "male",
        eventId: "shuttle-run",
        measurement: 52
      })
    ).toBe(3);

    expect(
      calculateOfficialGrade({
        gradeLevel: 6,
        sex: "female",
        eventId: "shuttle-run",
        measurement: 32
      })
    ).toBe(4);
  });

  it("computes official grades for newly supported elementary events", () => {
    expect(
      calculateOfficialGrade({
        gradeLevel: 4,
        sex: "female",
        eventId: "fifty-meter-run",
        measurement: 10.2
      })
    ).toBe(2);

    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "female",
        eventId: "curl-up",
        measurement: 36
      })
    ).toBe(2);

    expect(
      calculateOfficialGrade({
        gradeLevel: 6,
        sex: "male",
        eventId: "grip-strength",
        measurement: 35
      })
    ).toBe(1);

    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "male",
        eventId: "standing-long-jump",
        measurement: 160
      })
    ).toBe(2);

    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "female",
        eventId: "step-test",
        measurement: 60.5
      })
    ).toBe(3);

    expect(
      calculateOfficialGrade({
        gradeLevel: 4,
        sex: "male",
        eventId: "comprehensive-flexibility",
        measurement: 8
      })
    ).toBe(1);
  });

  it("enforces sex-specific official grade lookup", () => {
    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "male",
        eventId: "long-run-walk",
        measurement: 360
      })
    ).toBe(3);

    expect(
      calculateOfficialGrade({
        gradeLevel: 5,
        sex: "female",
        eventId: "long-run-walk",
        measurement: 360
      })
    ).toBe(3);
  });

  it("rejects official grade calculation for ineligible event and grade combinations", () => {
    expect(() =>
      calculateOfficialGrade({
        gradeLevel: 3,
        sex: "female",
        eventId: "long-run-walk",
        measurement: 340
      })
    ).toThrow("Event long-run-walk is not eligible for grade 3.");
  });

  it("fails fast when grade bands are malformed instead of relying on band order", () => {
    expect(() =>
      validateOfficialGradeBands({
        bands: [
          { grade: 1, min: 60 },
          { grade: 2, min: 44 },
          { grade: 3, min: 52 }
        ],
        betterDirection: "higher",
        eventId: "shuttle-run"
      })
    ).toThrow("Official grade bands for shuttle-run must be ordered from stricter to looser thresholds.");
  });

  it("rejects equal adjacent thresholds because they make first-match grading ambiguous", () => {
    expect(() =>
      validateOfficialGradeBands({
        bands: [
          { grade: 1, min: 60 },
          { grade: 2, min: 60 },
          { grade: 3, min: 52 }
        ],
        betterDirection: "higher",
        eventId: "shuttle-run"
      })
    ).toThrow("Official grade bands for shuttle-run must be ordered from stricter to looser thresholds.");
  });

  it("rejects semantically invalid grade ladder ordering", () => {
    expect(() =>
      validateOfficialGradeBands({
        bands: [
          { grade: 1, min: 60 },
          { grade: 3, min: 52 },
          { grade: 2, min: 44 }
        ],
        betterDirection: "higher",
        eventId: "shuttle-run"
      })
    ).toThrow("Official grade bands for shuttle-run must keep grades in ascending ladder order.");
  });
});
