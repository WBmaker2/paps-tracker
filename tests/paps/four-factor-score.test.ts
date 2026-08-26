import { PAPS_EVENT_DEFINITIONS } from "../../src/data/paps/events";
import {
  getPAPSScoreRule,
  measurementToUnit,
  PAPS_SCORE_RULES,
  unitToMeasurement
} from "../../src/data/paps/score-rules";
import {
  calculateEventScore,
  calculateFourFactorScore
} from "../../src/lib/paps/four-factor-score";

describe("PAPS 체지방 제외 4요인 항목 점수", () => {
  it("초5 남 왕복오래달리기를 별표 5의 정수 좌표로 환산한다", () => {
    const expected: Array<[number, number]> = [
      [22, 0],
      [23, 1],
      [28, 3],
      [29, 4],
      [33, 4],
      [34, 5],
      [39, 5],
      [40, 6],
      [49, 7],
      [100, 16],
      [101, 16],
      [102, 17],
      [103, 17],
      [104, 18],
      [105, 19],
      [106, 19],
      [107, 20]
    ];

    for (const [measurement, score] of expected) {
      expect(
        calculateEventScore({
          gradeLevel: 5,
          sex: "male",
          eventId: "shuttle-run",
          measurement
        })
      ).toBe(score);
    }
  });

  it("공식 예시 네 항목을 재현한다", () => {
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "shuttle-run",
        measurement: 40
      })
    ).toBe(6);
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "sit-and-reach",
        measurement: 12.7
      })
    ).toBe(17);
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "grip-strength",
        measurement: 19.8
      })
    ).toBe(9);
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "fifty-meter-run",
        measurement: 13.1
      })
    ).toBe(4);
  });

  it("종합유연성은 등급별 고정점수를 사용한다", () => {
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "comprehensive-flexibility",
        measurement: 0
      })
    ).toBe(4);
    expect(
      calculateEventScore({
        gradeLevel: 5,
        sex: "male",
        eventId: "comprehensive-flexibility",
        measurement: 8
      })
    ).toBe(20);
  });

  it("네 요인 합계·환산점수·등급을 정수 합계 경계로 계산한다", () => {
    expect(
      calculateFourFactorScore({
        "cardiorespiratory-endurance": 4,
        flexibility: 4,
        "strength-endurance": 4,
        power: 4
      })
    ).toMatchObject({
      cardiorespiratoryEndurance: 4,
      flexibility: 4,
      strengthEndurance: 4,
      power: 4,
      fourFactorSubtotal: 16,
      normalizedScore: 20,
      fourFactorGrade: 4
    });

    expect(
      calculateFourFactorScore({
        "cardiorespiratory-endurance": 16,
        flexibility: 16,
        "strength-endurance": 16,
        power: 16
      }).fourFactorGrade
    ).toBe(1);
    expect(
      calculateFourFactorScore({
        "cardiorespiratory-endurance": 15,
        flexibility: 16,
        "strength-endurance": 16,
        power: 16
      }).fourFactorGrade
    ).toBe(2);

    const boundaryCases: Array<[number, 1 | 2 | 3 | 4 | 5]> = [
      [15, 5],
      [16, 4],
      [31, 4],
      [32, 3],
      [47, 3],
      [48, 2],
      [63, 2],
      [64, 1]
    ];
    for (const [subtotal, grade] of boundaryCases) {
      const first = Math.min(subtotal, 20);
      const second = Math.min(Math.max(subtotal - first, 0), 20);
      const third = Math.min(Math.max(subtotal - first - second, 0), 20);
      const fourth = subtotal - first - second - third;
      expect(
        calculateFourFactorScore({
          "cardiorespiratory-endurance": first,
          flexibility: second,
          "strength-endurance": third,
          power: fourth
        }).fourFactorGrade
      ).toBe(grade);
    }
  });

  it("요인 누락·중복과 점수 규칙 미확인 조합은 거부한다", () => {
    expect(() =>
      calculateFourFactorScore({
        "cardiorespiratory-endurance": 10,
        flexibility: 10,
        "strength-endurance": 10
      } as never)
    ).toThrow();
    expect(() =>
      calculateFourFactorScore([
        { factorId: "flexibility", score: 10 },
        { factorId: "flexibility", score: 10 },
        { factorId: "strength-endurance", score: 10 },
        { factorId: "power", score: 10 }
      ])
    ).toThrow();
    expect(() =>
      calculateEventScore({
        gradeLevel: 3,
        sex: "male",
        eventId: "sit-and-reach",
        measurement: 1
      })
    ).toThrow();
  });

  it("모든 기존 종목 정의가 체지방 없는 네 요인 중 하나를 가진다", () => {
    expect(Object.keys(PAPS_EVENT_DEFINITIONS)).toHaveLength(9);
    for (const definition of Object.values(PAPS_EVENT_DEFINITIONS)) {
      expect([
        "cardiorespiratory-endurance",
        "flexibility",
        "strength-endurance",
        "power"
      ]).toContain(definition.factorId);
    }
  });

  it("공식 표를 가진 모든 초4~6·성별·종목 조합의 규칙을 생성한다", () => {
    const expectedKeys = Object.values(PAPS_EVENT_DEFINITIONS).flatMap((definition) =>
      definition.supportedGrades.flatMap((gradeLevel) =>
        (["male", "female"] as const).map(
          (sex) => `${gradeLevel}:${sex}:${definition.id}`
        )
      )
    );

    expect(Object.keys(PAPS_SCORE_RULES).sort()).toEqual(expectedKeys.sort());
    expect(Object.keys(PAPS_SCORE_RULES)).toHaveLength(48);
    for (const key of expectedKeys) {
      const [gradeLevel, sex, eventId] = key.split(":");
      expect(
        getPAPSScoreRule(
          Number(gradeLevel) as 4 | 5 | 6,
          sex as "male" | "female",
          eventId as keyof typeof PAPS_EVENT_DEFINITIONS
        )
      ).not.toBeNull();
    }
  });

  it("모든 규칙의 외곽 경계와 내부 band를 빈틈없이 검증한다", () => {
    for (const rule of Object.values(PAPS_SCORE_RULES)) {
      if (!rule) continue;
      const definition = PAPS_EVENT_DEFINITIONS[rule.eventId];

      if (rule.eventId === "comprehensive-flexibility") {
        expect(rule.bands).toEqual([]);
        expect(rule.fixedScores).toEqual({ 1: 20, 2: 16, 3: 12, 4: 8, 5: 4 });
        continue;
      }

      expect(rule.fixedScores).toBeUndefined();
      expect(rule.bands.length).toBe(5);
      const sortedBands = [...rule.bands].sort(
        (left, right) => measurementToUnit(left.min, rule.precision) - measurementToUnit(right.min, rule.precision)
      );
      for (let index = 0; index < sortedBands.length; index += 1) {
        const band = sortedBands[index];
        expect(measurementToUnit(band.min, rule.precision)).toBeLessThanOrEqual(
          measurementToUnit(band.max, rule.precision)
        );
        if (index > 0) {
          expect(measurementToUnit(band.min, rule.precision)).toBe(
            measurementToUnit(sortedBands[index - 1].max, rule.precision) + 1
          );
        }
      }

      const outerMinScore = calculateEventScore({
        gradeLevel: rule.gradeLevel,
        sex: rule.sex,
        eventId: rule.eventId,
        measurement: rule.outerMin
      });
      const outerMaxScore = calculateEventScore({
        gradeLevel: rule.gradeLevel,
        sex: rule.sex,
        eventId: rule.eventId,
        measurement: rule.outerMax
      });
      if (rule.betterDirection === "higher") {
        expect(outerMinScore).toBe(0);
        expect(outerMaxScore).toBe(20);
      } else {
        expect(outerMinScore).toBe(20);
        expect(outerMaxScore).toBe(0);
      }

      const minUnit = measurementToUnit(
        definition.measurementConstraints.min,
        rule.precision
      );
      const maxUnit = measurementToUnit(
        definition.measurementConstraints.max,
        rule.precision
      );
      let previousScore: number | null = null;
      for (let unit = minUnit; unit <= maxUnit; unit += 1) {
        const measurement = unitToMeasurement(unit, rule.precision);
        const score = calculateEventScore({
          gradeLevel: rule.gradeLevel,
          sex: rule.sex,
          eventId: rule.eventId,
          measurement
        });
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(20);
        if (previousScore !== null) {
          if (rule.betterDirection === "higher") {
            expect(score).toBeGreaterThanOrEqual(previousScore);
          } else {
            expect(score).toBeLessThanOrEqual(previousScore);
          }
        }
        previousScore = score;
      }
    }
  });

  it("종합유연성을 제외한 항목은 고정점 없이 방향별 단조성을 지킨다", () => {
    for (const rule of Object.values(PAPS_SCORE_RULES)) {
      if (!rule || rule.eventId === "comprehensive-flexibility") continue;
      const definition = PAPS_EVENT_DEFINITIONS[rule.eventId];
      const minUnit = measurementToUnit(definition.measurementConstraints.min, rule.precision);
      const maxUnit = measurementToUnit(definition.measurementConstraints.max, rule.precision);
      const first = calculateEventScore({
        gradeLevel: rule.gradeLevel,
        sex: rule.sex,
        eventId: rule.eventId,
        measurement: unitToMeasurement(minUnit, rule.precision)
      });
      const last = calculateEventScore({
        gradeLevel: rule.gradeLevel,
        sex: rule.sex,
        eventId: rule.eventId,
        measurement: unitToMeasurement(maxUnit, rule.precision)
      });
      if (rule.betterDirection === "higher") {
        expect(first).toBeLessThanOrEqual(last);
      } else {
        expect(first).toBeGreaterThanOrEqual(last);
      }
    }
  });
});
