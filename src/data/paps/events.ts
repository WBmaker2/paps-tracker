import type { PAPSEventDefinition } from "../../lib/paps/types";

export const PAPS_EVENT_DEFINITIONS: Record<PAPSEventDefinition["id"], PAPSEventDefinition> = {
  "sit-and-reach": {
    id: "sit-and-reach",
    label: "Sit and Reach",
    unit: "cm",
    betterDirection: "higher",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"]
  },
  "shuttle-run": {
    id: "shuttle-run",
    label: "Shuttle Run",
    unit: "laps",
    betterDirection: "higher",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"]
  },
  "long-run-walk": {
    id: "long-run-walk",
    label: "Long Run Walk",
    unit: "seconds",
    betterDirection: "lower",
    supportedGrades: [5, 6],
    supportedSessionTypes: ["official", "practice"]
  }
};
