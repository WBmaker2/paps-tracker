import { calculateOfficialGrade } from "../../src/lib/paps/grade";
import type { EventId, GradeLevel, StudentSex } from "../../src/lib/paps/types";

/**
 * Independent checkpoints transcribed from School Health Examination Rule,
 * Annex 4 (effective 2025-03-10), pp. 1-2. Values list grade 1 through 4
 * inclusive cutoffs; source values are the printed endpoints, not values
 * imported from the application rule table.
 */
const annex4Checkpoints: Array<{
  eventId: EventId;
  gradeLevel: GradeLevel;
  sex: StudentSex;
  direction: "higher" | "lower";
  cutoffs: [number, number, number, number];
}> = [
  { eventId: "shuttle-run", gradeLevel: 4, sex: "male", direction: "higher", cutoffs: [96, 69, 45, 26] },
  { eventId: "shuttle-run", gradeLevel: 4, sex: "female", direction: "higher", cutoffs: [77, 57, 40, 21] },
  { eventId: "shuttle-run", gradeLevel: 5, sex: "male", direction: "higher", cutoffs: [100, 73, 50, 29] },
  { eventId: "shuttle-run", gradeLevel: 6, sex: "female", direction: "higher", cutoffs: [93, 69, 50, 25] },
  { eventId: "sit-and-reach", gradeLevel: 5, sex: "male", direction: "higher", cutoffs: [8, 5, 1, -4] },
  { eventId: "sit-and-reach", gradeLevel: 6, sex: "female", direction: "higher", cutoffs: [14, 10, 5, 2] },
  { eventId: "long-run-walk", gradeLevel: 5, sex: "male", direction: "lower", cutoffs: [281, 324, 409, 479] },
  { eventId: "long-run-walk", gradeLevel: 6, sex: "female", direction: "lower", cutoffs: [299, 353, 429, 479] },
  { eventId: "step-test", gradeLevel: 5, sex: "male", direction: "higher", cutoffs: [76, 62, 52, 47] },
  { eventId: "comprehensive-flexibility", gradeLevel: 4, sex: "female", direction: "higher", cutoffs: [8, 7, 6, 5] },
  { eventId: "curl-up", gradeLevel: 4, sex: "male", direction: "higher", cutoffs: [80, 40, 22, 7] },
  { eventId: "curl-up", gradeLevel: 6, sex: "female", direction: "higher", cutoffs: [60, 43, 23, 7] },
  { eventId: "grip-strength", gradeLevel: 4, sex: "female", direction: "higher", cutoffs: [29, 18, 13.5, 10.5] },
  { eventId: "grip-strength", gradeLevel: 6, sex: "male", direction: "higher", cutoffs: [35, 26.5, 19, 15] },
  { eventId: "fifty-meter-run", gradeLevel: 4, sex: "male", direction: "lower", cutoffs: [8.8, 9.7, 10.5, 13.2] },
  { eventId: "fifty-meter-run", gradeLevel: 5, sex: "female", direction: "lower", cutoffs: [8.9, 9.9, 10.7, 13] },
  { eventId: "standing-long-jump", gradeLevel: 5, sex: "male", direction: "higher", cutoffs: [180.1, 159.1, 141.1, 111.1] },
  { eventId: "standing-long-jump", gradeLevel: 6, sex: "female", direction: "higher", cutoffs: [175.1, 144.1, 127.1, 100.1] }
];

describe("2025 학교건강검사규칙 별표 4 독립 경계 fixture", () => {
  it("원문 경계값과 바로 인접한 측정값을 같은 등급으로 판정한다", () => {
    for (const checkpoint of annex4Checkpoints) {
      for (let index = 0; index < checkpoint.cutoffs.length; index += 1) {
        const grade = (index + 1) as 1 | 2 | 3 | 4;
        const cutoff = checkpoint.cutoffs[index];
        const precision = checkpoint.eventId === "fifty-meter-run" ? 2 :
          checkpoint.eventId === "sit-and-reach" || checkpoint.eventId === "step-test" || checkpoint.eventId === "grip-strength" || checkpoint.eventId === "standing-long-jump" ? 1 : 0;
        const adjacent = 10 ** -precision;
        const favorable = checkpoint.direction === "higher" ? cutoff : cutoff;
        const unfavorable = checkpoint.direction === "higher" ? cutoff - adjacent : cutoff + adjacent;
        expect(calculateOfficialGrade({ ...checkpoint, measurement: favorable })).toBe(grade);
        if (grade < 5) {
          expect(calculateOfficialGrade({ ...checkpoint, measurement: unfavorable })).toBe(grade + 1);
        }
      }
    }
  });
});
