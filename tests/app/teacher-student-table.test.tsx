import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PAPSClassroom, PAPSStudent } from "../../src/lib/paps/types";

const notifyTeacherDataRefresh = vi.fn();

vi.mock("../../src/components/teacher/teacher-data-refresh", () => ({
  buildTeacherMutationHeaders: (headers?: HeadersInit) => new Headers(headers),
  notifyTeacherDataRefresh
}));

const classes: PAPSClassroom[] = [
  { id: "class-5-1", schoolId: "school-1", academicYear: 2026, gradeLevel: 5, classNumber: 1, label: "5-1", active: true },
  { id: "class-5-2", schoolId: "school-1", academicYear: 2026, gradeLevel: 5, classNumber: 2, label: "5-2", active: true }
];

describe("teacher student roster", () => {
  afterEach(() => {
    notifyTeacherDataRefresh.mockReset();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("updates the student table locally and only syncs the next version baseline", async () => {
    const { StudentTable } = await import("../../src/components/teacher/student-table");
    const fetchMock = vi.fn(async () =>
      Response.json({
        student: {
          id: "student-2",
          schoolId: "school-1",
          classId: "class-5-1",
          studentNumber: 2,
          name: "김학생",
          sex: "female",
          gradeLevel: 5,
          active: true
        } satisfies PAPSStudent,
        teacherStateVersion: "version-students-2"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StudentTable
        students={[
          {
            id: "student-1",
            schoolId: "school-1",
            classId: "class-5-1",
            studentNumber: 1,
            name: "이학생",
            sex: "male",
            gradeLevel: 5,
            active: true
          }
        ]}
        classes={classes}
        schoolId="school-1"
      />
    );

    fireEvent.change(screen.getByLabelText("학생 이름"), {
      target: { value: "김학생" }
    });
    fireEvent.change(screen.getByLabelText("번호"), {
      target: { value: "2" }
    });
    fireEvent.change(screen.getByLabelText("성별"), {
      target: { value: "female" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학생 추가" }));

    await screen.findByText("학생 명단을 저장했습니다.");

    expect(screen.getByText("2번 김학생")).toBeInTheDocument();
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-students-2"
    });
  });

  it("shows field errors locally and does not send blank names or invalid numbers", async () => {
    const { StudentTable } = await import("../../src/components/teacher/student-table");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<StudentTable students={[]} classes={classes} schoolId="school-1" />);
    fireEvent.change(screen.getByLabelText("학생 이름"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("번호"), { target: { value: "1.5" } });
    fireEvent.click(screen.getByRole("button", { name: "학생 추가" }));

    expect(screen.getByText("학생 이름을 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByText("번호는 1 이상의 정수로 입력해주세요.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("filters the visible student roster by the selected class and allows editing an existing student", async () => {
    const { StudentTable } = await import("../../src/components/teacher/student-table");
    const fetchMock = vi.fn(async (_input, init) => {
      const body =
        init?.body && typeof init.body === "string"
          ? (JSON.parse(init.body) as {
              id?: string;
              classId: string;
              name: string;
              sex: "male" | "female";
              studentNumber: number;
            })
          : null;

      return Response.json({
        student: {
          id: body?.id ?? "student-2",
          schoolId: "school-1",
          classId: body?.classId ?? "class-5-1",
          studentNumber: body?.studentNumber ?? 1,
          name: body?.name ?? "김학생",
          sex: body?.sex ?? "female",
          gradeLevel: body?.classId === "class-5-2" ? 5 : 5,
          active: true
        } satisfies PAPSStudent,
        teacherStateVersion: "version-students-3"
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StudentTable
        students={[
          {
            id: "student-1",
            schoolId: "school-1",
            classId: "class-5-1",
            studentNumber: 1,
            name: "이학생",
            sex: "male",
            gradeLevel: 5,
            active: true
          },
          {
            id: "student-2",
            schoolId: "school-1",
            classId: "class-5-2",
            studentNumber: 2,
            name: "박학생",
            sex: "female",
            gradeLevel: 5,
            active: true
          }
        ]}
        classes={classes}
        schoolId="school-1"
      />
    );

    expect(screen.getByText("1번 이학생")).toBeInTheDocument();
    expect(screen.queryByText("2번 박학생")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("반"), {
      target: { value: "class-5-2" }
    });

    expect(screen.queryByText("1번 이학생")).not.toBeInTheDocument();
    expect(screen.getByText("2번 박학생")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "박학생 수정" }));

    expect((screen.getByLabelText("학생 이름") as HTMLInputElement).value).toBe("박학생");
    expect(document.activeElement).toBe(screen.getByLabelText("학생 이름"));
    expect((screen.getByLabelText("번호") as HTMLInputElement).value).toBe("2");
    expect(screen.getByRole("button", { name: "학생 수정" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("학생 이름"), {
      target: { value: "박수정" }
    });
    fireEvent.change(screen.getByLabelText("번호"), {
      target: { value: "7" }
    });
    fireEvent.click(screen.getByRole("button", { name: "학생 수정" }));

    await screen.findByText("학생 정보를 수정했습니다.");

    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/students",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"id\":\"student-2\"")
      })
    );
    expect(screen.getByText("7번 박수정")).toBeInTheDocument();
    expect(screen.queryByText("2번 박학생")).not.toBeInTheDocument();
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-students-3"
    });
  });

  it("deletes an existing student locally and only syncs the next version baseline", async () => {
    const { StudentTable } = await import("../../src/components/teacher/student-table");
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        teacherStateVersion: "version-students-deleted"
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StudentTable
        students={[
          {
            id: "student-1",
            schoolId: "school-1",
            classId: "class-5-1",
            studentNumber: 1,
            name: "이학생",
            sex: "male",
            gradeLevel: 5,
            active: true
          },
          {
            id: "student-2",
            schoolId: "school-1",
            classId: "class-5-1",
            studentNumber: 2,
            name: "김학생",
            sex: "female",
            gradeLevel: 5,
            active: true
          }
        ]}
        classes={classes}
        schoolId="school-1"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "김학생 보관" }));

    await screen.findByText("학생을 보관 처리했습니다. 기존 측정 기록은 그대로 보존됩니다.");

    expect(confirmSpy).toHaveBeenCalledWith(
      "김학생 학생을 명단에서 보관 처리할까요? 학생 입력 화면에서는 보이지 않습니다. 기존 측정 기록은 보존되며, 같은 번호로 다시 등록해도 기존 기록은 새 학생과 자동 연결되지 않습니다."
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/students?studentId=student-2",
      expect.objectContaining({
        method: "DELETE"
      })
    );
    expect(screen.queryByText("2번 김학생")).not.toBeInTheDocument();
    expect(screen.getByText("1번 이학생")).toBeInTheDocument();
    expect(notifyTeacherDataRefresh).toHaveBeenCalledWith({
      refresh: false,
      nextVersion: "version-students-deleted"
    });
  });

});
