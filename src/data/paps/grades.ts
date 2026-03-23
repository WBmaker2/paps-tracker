import type { GradeLevel, OfficialGradeRule, StudentSex } from "../../lib/paps/types";

type GradeRuleKey = `${GradeLevel}:${StudentSex}:${OfficialGradeRule["eventId"]}`;

const gradeRuleKey = (
  gradeLevel: GradeLevel,
  sex: StudentSex,
  eventId: OfficialGradeRule["eventId"]
): GradeRuleKey => `${gradeLevel}:${sex}:${eventId}`;

export const OFFICIAL_GRADE_RULES: Partial<Record<GradeRuleKey, OfficialGradeRule>> = {
  [gradeRuleKey(5, "male", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 5,
    sex: "male",
    bands: [
      { grade: 1, min: 60 },
      { grade: 2, min: 52 },
      { grade: 3, min: 44 },
      { grade: 4, min: 36 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(5, "female", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 5,
    sex: "female",
    bands: [
      { grade: 1, min: 58 },
      { grade: 2, min: 50 },
      { grade: 3, min: 42 },
      { grade: 4, min: 34 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(5, "male", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 5,
    sex: "male",
    bands: [
      { grade: 1, min: 26 },
      { grade: 2, min: 23 },
      { grade: 3, min: 20 },
      { grade: 4, min: 17 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(5, "female", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 5,
    sex: "female",
    bands: [
      { grade: 1, min: 26 },
      { grade: 2, min: 23 },
      { grade: 3, min: 20 },
      { grade: 4, min: 17 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(5, "male", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 5,
    sex: "male",
    bands: [
      { grade: 1, max: 330 },
      { grade: 2, max: 360 },
      { grade: 3, max: 390 },
      { grade: 4, max: 420 },
      { grade: 5, max: Number.POSITIVE_INFINITY }
    ]
  },
  [gradeRuleKey(5, "female", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 5,
    sex: "female",
    bands: [
      { grade: 1, max: 320 },
      { grade: 2, max: 340 },
      { grade: 3, max: 360 },
      { grade: 4, max: 380 },
      { grade: 5, max: Number.POSITIVE_INFINITY }
    ]
  },
  [gradeRuleKey(6, "male", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 6,
    sex: "male",
    bands: [
      { grade: 1, min: 27 },
      { grade: 2, min: 24 },
      { grade: 3, min: 21 },
      { grade: 4, min: 18 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(6, "male", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 6,
    sex: "male",
    bands: [
      { grade: 1, min: 62 },
      { grade: 2, min: 54 },
      { grade: 3, min: 46 },
      { grade: 4, min: 38 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(6, "female", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 6,
    sex: "female",
    bands: [
      { grade: 1, min: 27 },
      { grade: 2, min: 24 },
      { grade: 3, min: 21 },
      { grade: 4, min: 18 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(6, "female", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 6,
    sex: "female",
    bands: [
      { grade: 1, min: 56 },
      { grade: 2, min: 48 },
      { grade: 3, min: 40 },
      { grade: 4, min: 32 },
      { grade: 5, min: 0 }
    ]
  },
  [gradeRuleKey(6, "male", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 6,
    sex: "male",
    bands: [
      { grade: 1, max: 325 },
      { grade: 2, max: 355 },
      { grade: 3, max: 385 },
      { grade: 4, max: 415 },
      { grade: 5, max: Number.POSITIVE_INFINITY }
    ]
  },
  [gradeRuleKey(6, "female", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 6,
    sex: "female",
    bands: [
      { grade: 1, max: 315 },
      { grade: 2, max: 335 },
      { grade: 3, max: 355 },
      { grade: 4, max: 375 },
      { grade: 5, max: Number.POSITIVE_INFINITY }
    ]
  }
};

export const getOfficialGradeRule = (
  gradeLevel: GradeLevel,
  sex: StudentSex,
  eventId: OfficialGradeRule["eventId"]
): OfficialGradeRule | null => OFFICIAL_GRADE_RULES[gradeRuleKey(gradeLevel, sex, eventId)] ?? null;
