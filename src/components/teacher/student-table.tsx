"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";

import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import type { PAPSClassroom, PAPSStudent } from "../../lib/paps/types";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

const sortStudents = (students: PAPSStudent[]): PAPSStudent[] =>
  students.slice().sort((left, right) => {
    if (left.classId !== right.classId) {
      return left.classId.localeCompare(right.classId);
    }

    if ((left.studentNumber ?? Number.MAX_SAFE_INTEGER) !== (right.studentNumber ?? Number.MAX_SAFE_INTEGER)) {
      return (left.studentNumber ?? Number.MAX_SAFE_INTEGER) - (right.studentNumber ?? Number.MAX_SAFE_INTEGER);
    }

    return left.name.localeCompare(right.name, "ko");
  });

export function StudentTable({
  students,
  classes,
  schoolId,
  sheetConnected = true,
  sheetStatus
}: {
  students: PAPSStudent[];
  classes: PAPSClassroom[];
  schoolId?: string;
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
}) {
  const [items, setItems] = useState(() => sortStudents(students));
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [sex, setSex] = useState<"male" | "female">("female");
  const [studentNumber, setStudentNumber] = useState("1");
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const visibleItems = useMemo(
    () => items.filter((student) => student.classId === classId),
    [classId, items]
  );

  useEffect(() => {
    setItems(sortStudents(students));
  }, [students]);

  useEffect(() => {
    if (!classes.some((entry) => entry.id === classId)) {
      setClassId(classes[0]?.id ?? "");
    }
  }, [classId, classes]);

  const resetForm = () => {
    setEditingStudentId(null);
    setName("");
    setSex("female");
    setStudentNumber("1");
  };

  const startEditingStudent = (student: PAPSStudent) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setClassId(student.classId);
    setSex(student.sex);
    setStudentNumber(student.studentNumber ? String(student.studentNumber) : "1");
    setMessage(null);
  };

  const submitStudent = () => {
    if (!sheetConnected) {
      setMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    const classroom = classes.find((entry) => entry.id === classId);

    if (!classroom) {
      setMessage("반을 먼저 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            id: editingStudentId,
            schoolId,
            classId,
            name,
            sex,
            studentNumber: Number(studentNumber),
            gradeLevel: classroom.gradeLevel
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          student?: PAPSStudent;
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.student) {
          throw new Error(payload.error ?? "학생을 저장하지 못했습니다.");
        }

        setItems((currentItems) =>
          sortStudents(
            editingStudentId
              ? currentItems.map((entry) => (entry.id === payload.student!.id ? payload.student! : entry))
              : [...currentItems, payload.student!]
          )
        );
        setMessage(editingStudentId ? "학생 정보를 수정했습니다." : "학생 명단을 저장했습니다.");
        resetForm();
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "학생을 저장하지 못했습니다.");
      }
    });
  };

  const deleteStudent = (student: PAPSStudent) => {
    if (!sheetConnected) {
      setMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    const confirmed = window.confirm(
      `학생 명단에서 ${student.name}을(를) 삭제할까요? 삭제하면 학생 입력 화면에도 더 이상 보이지 않습니다.`
    );

    if (!confirmed) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(
          `/api/students?studentId=${encodeURIComponent(student.id)}`,
          {
            method: "DELETE",
            headers: buildTeacherMutationHeaders()
          }
        );
        const payload = (await response.json()) as {
          error?: string;
          teacherStateVersion?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "학생을 삭제하지 못했습니다.");
        }

        setItems((currentItems) =>
          sortStudents(currentItems.filter((entry) => entry.id !== student.id))
        );
        if (editingStudentId === student.id) {
          resetForm();
        }
        setMessage("학생 명단에서 삭제했습니다.");
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "학생을 삭제하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">학생 명단</h2>
        <p className="text-sm text-ink/70">반별 학생을 추가하고 현재 로스터를 확인합니다.</p>
      </div>
      {!sheetConnected ? (
        <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink/80">
          {sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요."}
        </div>
      ) : null}
      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm">
          학생 이름
          <input
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          반
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          번호
          <input
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={studentNumber}
            onChange={(event) => setStudentNumber(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          성별
          <select
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={sex}
            onChange={(event) => setSex(event.target.value as "male" | "female")}
          >
            <option value="female">여학생</option>
            <option value="male">남학생</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
          disabled={isPending}
          onClick={submitStudent}
        >
          {editingStudentId ? "학생 수정" : "학생 추가"}
        </button>
        {editingStudentId ? (
          <button
            type="button"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium"
            disabled={isPending}
            onClick={resetForm}
          >
            수정 취소
          </button>
        ) : null}
        {message ? <p className="text-sm text-ink/70">{message}</p> : null}
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink/10">
        <table className="min-w-full divide-y divide-ink/10 text-sm">
          <thead className="bg-canvas/60 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">번호</th>
              <th className="px-4 py-3 font-medium">이름</th>
              <th className="px-4 py-3 font-medium">반</th>
              <th className="px-4 py-3 font-medium">성별</th>
              <th className="px-4 py-3 font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {visibleItems.length > 0 ? (
              visibleItems.map((student) => (
                <tr key={student.id}>
                  <td className="px-4 py-3">{student.studentNumber ?? "-"}</td>
                  <td className="px-4 py-3 font-medium">{student.name}</td>
                  <td className="px-4 py-3">
                    {classes.find((entry) => entry.id === student.classId)?.label ?? student.classId}
                  </td>
                  <td className="px-4 py-3">{student.sex === "female" ? "여학생" : "남학생"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => startEditingStudent(student)}
                        disabled={isPending}
                      >
                        {student.name} 수정
                      </button>
                      <button
                        type="button"
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => deleteStudent(student)}
                        disabled={isPending}
                      >
                        {student.name} 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink/60">
                  선택한 반에 등록된 학생이 아직 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
