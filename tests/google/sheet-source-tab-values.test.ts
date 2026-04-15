import { describe, expect, it } from "vitest";

import {
  buildSettingsTabValues,
  buildStudentTabValues
} from "../../src/lib/google/sheet-source-tab-values";

describe("Google Sheet source tab values", () => {
  it("builds settings values with machine rows and split-session guidance", () => {
    const values = buildSettingsTabValues({
      spreadsheetId: "sheet-123",
      school: {
        id: "school-1",
        name: "Alpha Elementary",
        teacherIds: ["teacher-1"],
        sheetUrl: "https://docs.google.com/spreadsheets/d/sheet-123/edit",
        createdAt: "2026-03-23T09:00:00.000Z",
        updatedAt: "2026-03-23T09:00:00.000Z"
      },
      classes: [
        {
          id: "class-1",
          schoolId: "school-1",
          academicYear: 2026,
          gradeLevel: 5,
          classNumber: 1,
          label: "5-1",
          active: true
        }
      ],
      teachers: [
        {
          id: "teacher-1",
          schoolId: "school-1",
          name: "Teacher Kim",
          email: "teacher@example.com",
          createdAt: "2026-03-23T09:00:00.000Z",
          updatedAt: "2026-03-23T09:00:00.000Z"
        }
      ],
      sessions: [
        {
          id: "session-1",
          schoolId: "school-1",
          teacherId: "teacher-1",
          academicYear: 2026,
          name: "Split Session",
          gradeLevel: 5,
          sessionType: "practice",
          classScope: "split",
          eventId: "shuttle-run",
          classTargets: [{ classId: "class-1", eventId: "shuttle-run" }],
          isOpen: true,
          createdAt: "2026-03-23T09:00:00.000Z"
        }
      ]
    });

    expect(values[0]?.slice(0, 3)).toEqual(["항목", "값", "설명"]);
    expect(values[5]?.[1]).toBe("1반형 / 2반 분할형");
    expect(values.find((row) => row[0] === "__PAPS_SCHOOL")).toEqual([
      "__PAPS_SCHOOL",
      "school-1",
      "Alpha Elementary",
      "https://docs.google.com/spreadsheets/d/sheet-123/edit",
      "2026-03-23T09:00:00.000Z",
      "2026-03-23T09:00:00.000Z"
    ]);
  });

  it("builds student values in grade/class/number/name order", () => {
    const values = buildStudentTabValues({
      classes: [
        {
          id: "class-5-1",
          schoolId: "school-1",
          academicYear: 2026,
          gradeLevel: 5,
          classNumber: 1,
          label: "5-1",
          active: true
        },
        {
          id: "class-5-2",
          schoolId: "school-1",
          academicYear: 2026,
          gradeLevel: 5,
          classNumber: 2,
          label: "5-2",
          active: true
        }
      ],
      students: [
        {
          id: "student-3",
          schoolId: "school-1",
          classId: "class-5-2",
          studentNumber: 2,
          name: "Park",
          sex: "male",
          gradeLevel: 5,
          active: false
        },
        {
          id: "student-2",
          schoolId: "school-1",
          classId: "class-5-1",
          studentNumber: 2,
          name: "Kim",
          sex: "female",
          gradeLevel: 5,
          active: true
        },
        {
          id: "student-1",
          schoolId: "school-1",
          classId: "class-5-1",
          studentNumber: 1,
          name: "Lee",
          sex: "male",
          gradeLevel: 5,
          active: true
        }
      ]
    });

    expect(values[0]?.slice(0, 4)).toEqual(["학생ID", "학년도", "학년", "반"]);
    expect(values.slice(1, 4)).toEqual([
      ["student-1", "2026", "5", "1", "1", "Lee", "남", "Y", ""],
      ["student-2", "2026", "5", "1", "2", "Kim", "여", "Y", ""],
      ["student-3", "2026", "5", "2", "2", "Park", "남", "N", ""]
    ]);
  });
});
