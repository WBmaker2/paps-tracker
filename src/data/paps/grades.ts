import type { GradeLevel, OfficialGradeRule, StudentSex } from "../../lib/paps/types";

type GradeRuleKey = `${GradeLevel}:${StudentSex}:${OfficialGradeRule["eventId"]}`;

const gradeRuleKey = (
  gradeLevel: GradeLevel,
  sex: StudentSex,
  eventId: OfficialGradeRule["eventId"]
): GradeRuleKey => `${gradeLevel}:${sex}:${eventId}`;

const higherBands = (
  grade1Min: number,
  grade2Min: number,
  grade3Min: number,
  grade4Min: number,
  grade5Min = 0
) => [
  { grade: 1 as const, min: grade1Min },
  { grade: 2 as const, min: grade2Min },
  { grade: 3 as const, min: grade3Min },
  { grade: 4 as const, min: grade4Min },
  { grade: 5 as const, min: grade5Min }
];

const lowerBands = (
  grade1Max: number,
  grade2Max: number,
  grade3Max: number,
  grade4Max: number
) => [
  { grade: 1 as const, max: grade1Max },
  { grade: 2 as const, max: grade2Max },
  { grade: 3 as const, max: grade3Max },
  { grade: 4 as const, max: grade4Max },
  { grade: 5 as const, max: Number.POSITIVE_INFINITY }
];

export const OFFICIAL_GRADE_RULES: Partial<Record<GradeRuleKey, OfficialGradeRule>> = {
  [gradeRuleKey(4, "male", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 4,
    sex: "male",
    bands: higherBands(96, 69, 45, 26)
  },
  [gradeRuleKey(4, "female", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 4,
    sex: "female",
    bands: higherBands(77, 57, 40, 21)
  },
  [gradeRuleKey(5, "male", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(100, 73, 50, 29)
  },
  [gradeRuleKey(5, "female", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(85, 63, 45, 23)
  },
  [gradeRuleKey(6, "male", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(104, 78, 54, 32)
  },
  [gradeRuleKey(6, "female", "shuttle-run")]: {
    eventId: "shuttle-run",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(93, 69, 50, 25)
  },
  [gradeRuleKey(5, "male", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(8, 5, 1, -4, Number.NEGATIVE_INFINITY)
  },
  [gradeRuleKey(5, "female", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(10, 7, 5, 1, Number.NEGATIVE_INFINITY)
  },
  [gradeRuleKey(6, "male", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(8, 5, 1, -4, Number.NEGATIVE_INFINITY)
  },
  [gradeRuleKey(6, "female", "sit-and-reach")]: {
    eventId: "sit-and-reach",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(14, 10, 5, 2, Number.NEGATIVE_INFINITY)
  },
  [gradeRuleKey(5, "male", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 5,
    sex: "male",
    bands: lowerBands(281, 324, 409, 479)
  },
  [gradeRuleKey(5, "female", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 5,
    sex: "female",
    bands: lowerBands(299, 359, 441, 501)
  },
  [gradeRuleKey(6, "male", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 6,
    sex: "male",
    bands: lowerBands(250, 314, 379, 449)
  },
  [gradeRuleKey(6, "female", "long-run-walk")]: {
    eventId: "long-run-walk",
    gradeLevel: 6,
    sex: "female",
    bands: lowerBands(299, 353, 429, 479)
  },
  [gradeRuleKey(5, "male", "step-test")]: {
    eventId: "step-test",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(76, 62, 52, 47)
  },
  [gradeRuleKey(5, "female", "step-test")]: {
    eventId: "step-test",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(76, 62, 52, 47)
  },
  [gradeRuleKey(6, "male", "step-test")]: {
    eventId: "step-test",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(76, 62, 52, 47)
  },
  [gradeRuleKey(6, "female", "step-test")]: {
    eventId: "step-test",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(76, 62, 52, 47)
  },
  [gradeRuleKey(4, "male", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 4,
    sex: "male",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(4, "female", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 4,
    sex: "female",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(5, "male", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(5, "female", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(6, "male", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(6, "female", "comprehensive-flexibility")]: {
    eventId: "comprehensive-flexibility",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(8, 7, 6, 5)
  },
  [gradeRuleKey(4, "male", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 4,
    sex: "male",
    bands: higherBands(80, 40, 22, 7)
  },
  [gradeRuleKey(4, "female", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 4,
    sex: "female",
    bands: higherBands(60, 29, 18, 6)
  },
  [gradeRuleKey(5, "male", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(80, 40, 22, 10)
  },
  [gradeRuleKey(5, "female", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(60, 36, 23, 7)
  },
  [gradeRuleKey(6, "male", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(80, 40, 22, 10)
  },
  [gradeRuleKey(6, "female", "curl-up")]: {
    eventId: "curl-up",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(60, 43, 23, 7)
  },
  [gradeRuleKey(4, "male", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 4,
    sex: "male",
    bands: higherBands(31, 18.5, 15, 11.5)
  },
  [gradeRuleKey(4, "female", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 4,
    sex: "female",
    bands: higherBands(29, 18, 13.5, 10.5)
  },
  [gradeRuleKey(5, "male", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(31, 23, 17, 12.5)
  },
  [gradeRuleKey(5, "female", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(29, 19, 15.5, 12)
  },
  [gradeRuleKey(6, "male", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(35, 26.5, 19, 15)
  },
  [gradeRuleKey(6, "female", "grip-strength")]: {
    eventId: "grip-strength",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(33, 22, 19, 14)
  },
  [gradeRuleKey(4, "male", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 4,
    sex: "male",
    bands: lowerBands(8.8, 9.7, 10.5, 13.2)
  },
  [gradeRuleKey(4, "female", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 4,
    sex: "female",
    bands: lowerBands(9.4, 10.4, 11, 13.3)
  },
  [gradeRuleKey(5, "male", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 5,
    sex: "male",
    bands: lowerBands(8.5, 9.4, 10.2, 13.2)
  },
  [gradeRuleKey(5, "female", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 5,
    sex: "female",
    bands: lowerBands(8.9, 9.9, 10.7, 13)
  },
  [gradeRuleKey(6, "male", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 6,
    sex: "male",
    bands: lowerBands(8.1, 9.1, 10, 12.5)
  },
  [gradeRuleKey(6, "female", "fifty-meter-run")]: {
    eventId: "fifty-meter-run",
    gradeLevel: 6,
    sex: "female",
    bands: lowerBands(8.9, 9.8, 10.7, 12.9)
  },
  [gradeRuleKey(4, "male", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 4,
    sex: "male",
    bands: higherBands(170.1, 149.1, 130.1, 100.1)
  },
  [gradeRuleKey(4, "female", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 4,
    sex: "female",
    bands: higherBands(161.1, 135.1, 119.1, 97.1)
  },
  [gradeRuleKey(5, "male", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 5,
    sex: "male",
    bands: higherBands(180.1, 159.1, 141.1, 111.1)
  },
  [gradeRuleKey(5, "female", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 5,
    sex: "female",
    bands: higherBands(170.1, 139.1, 123.1, 100.1)
  },
  [gradeRuleKey(6, "male", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 6,
    sex: "male",
    bands: higherBands(200.1, 167.1, 148.1, 122.1)
  },
  [gradeRuleKey(6, "female", "standing-long-jump")]: {
    eventId: "standing-long-jump",
    gradeLevel: 6,
    sex: "female",
    bands: higherBands(175.1, 144.1, 127.1, 100.1)
  }
};

export const getOfficialGradeRule = (
  gradeLevel: GradeLevel,
  sex: StudentSex,
  eventId: OfficialGradeRule["eventId"]
): OfficialGradeRule | null => OFFICIAL_GRADE_RULES[gradeRuleKey(gradeLevel, sex, eventId)] ?? null;
