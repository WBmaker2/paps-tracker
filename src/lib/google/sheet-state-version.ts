import { createHash } from "node:crypto";

import type { TeacherBootstrap } from "../store/paps-store-types";

const normalizeStateValue = (value: unknown): unknown => {
  if (value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeStateValue(entry))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, nestedValue]) => [key, normalizeStateValue(nestedValue)])
    );
  }

  return value;
};

export const buildTeacherStateVersion = (bootstrap: TeacherBootstrap): string =>
  createHash("sha256")
    .update(JSON.stringify(normalizeStateValue(bootstrap)))
    .digest("hex");
