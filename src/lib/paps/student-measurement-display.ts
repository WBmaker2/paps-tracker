const STUDENT_UNITS: Record<string, string> = {
  laps: "회",
  reps: "회",
  seconds: "초",
  PEI: "심폐지구력 지수",
  cm: "cm",
  kg: "kg",
  m: "m",
  점: "점"
};

/** Translate internal event units for learner-facing labels without changing stored values. */
export const formatStudentUnit = (unit: string): string => STUDENT_UNITS[unit] ?? unit;
