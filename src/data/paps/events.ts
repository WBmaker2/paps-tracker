import type { PAPSEventDefinition } from "../../lib/paps/types";

export const PAPS_EVENT_DEFINITIONS: Record<PAPSEventDefinition["id"], PAPSEventDefinition> = {
  "sit-and-reach": {
    id: "sit-and-reach",
    label: "앉아윗몸앞으로굽히기",
    unit: "cm",
    betterDirection: "higher",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: -40,
      max: 50,
      precision: 1
    }
  },
  "shuttle-run": {
    id: "shuttle-run",
    label: "왕복오래달리기",
    unit: "laps",
    betterDirection: "higher",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 150,
      precision: 0
    }
  },
  "long-run-walk": {
    id: "long-run-walk",
    label: "오래달리기-걷기",
    unit: "seconds",
    betterDirection: "lower",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 120,
      max: 999,
      precision: 0
    }
  },
  "step-test": {
    id: "step-test",
    label: "스텝검사",
    unit: "PEI",
    betterDirection: "higher",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 100,
      precision: 1
    }
  },
  "comprehensive-flexibility": {
    id: "comprehensive-flexibility",
    label: "종합유연성",
    unit: "점",
    betterDirection: "higher",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 8,
      precision: 0
    }
  },
  "curl-up": {
    id: "curl-up",
    label: "윗몸말아올리기",
    unit: "reps",
    betterDirection: "higher",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 200,
      precision: 0
    }
  },
  "grip-strength": {
    id: "grip-strength",
    label: "악력",
    unit: "kg",
    betterDirection: "higher",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 200,
      precision: 1
    }
  },
  "fifty-meter-run": {
    id: "fifty-meter-run",
    label: "50m달리기",
    unit: "seconds",
    betterDirection: "lower",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 5,
      max: 30,
      precision: 2
    }
  },
  "standing-long-jump": {
    id: "standing-long-jump",
    label: "제자리멀리뛰기",
    unit: "cm",
    betterDirection: "higher",
    supportedGrades: [4, 5, 6],
    supportedSessionTypes: ["official", "practice"],
    measurementConstraints: {
      min: 0,
      max: 300,
      precision: 1
    }
  }
};
