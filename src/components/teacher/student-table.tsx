"use client";

import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";

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

type StudentFieldErrors = Partial<Record<"name" | "studentNumber", string>>;

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
  const [fieldErrors, setFieldErrors] = useState<StudentFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement>(null);
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

  useEffect(() => {
    if (editingStudentId) {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView?.({ block: "nearest" });
    }
  }, [editingStudentId]);

  const resetForm = () => {
    setEditingStudentId(null);
    setName("");
    setSex("female");
    setStudentNumber("1");
    setFieldErrors({});
  };

  const startEditingStudent = (student: PAPSStudent) => {
    setEditingStudentId(student.id);
    setName(student.name);
    setClassId(student.classId);
    setSex(student.sex);
    setStudentNumber(student.studentNumber ? String(student.studentNumber) : "1");
    setMessage(null);
    setFieldErrors({});
  };

  const submitStudent = () => {
    if (!sheetConnected) {
      setMessage(sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요.");
      return;
    }

    const classroom = classes.find((entry) => entry.id === classId);
    const nextFieldErrors: StudentFieldErrors = {};

    if (!name.trim()) nextFieldErrors.name = "학생 이름을 입력해주세요.";
    const parsedStudentNumber = Number(studentNumber);
    if (!Number.isSafeInteger(parsedStudentNumber) || parsedStudentNumber < 1) {
      nextFieldErrors.studentNumber = "번호는 1 이상의 정수로 입력해주세요.";
    }

    if (!classroom) {
      setMessage("반을 먼저 선택해주세요.");
      return;
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setMessage("입력 내용을 확인해주세요.");
      return;
    }

    setFieldErrors({});
    setMessage("학생 정보를 저장하고 있습니다.");
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
            studentNumber: parsedStudentNumber,
            gradeLevel: classroom.gradeLevel
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          fieldErrors?: StudentFieldErrors;
          student?: PAPSStudent;
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.student) {
          const error = new Error(payload.error ?? "학생을 저장하지 못했습니다.") as Error & {
            fieldErrors?: StudentFieldErrors;
          };
          error.fieldErrors = payload.fieldErrors;
          throw error;
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
        nameInputRef.current?.focus();
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        if (error instanceof Error && "fieldErrors" in error) {
          setFieldErrors((error as Error & { fieldErrors?: StudentFieldErrors }).fieldErrors ?? {});
        }
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
      `${student.name} 학생을 명단에서 보관 처리할까요? 학생 입력 화면에서는 보이지 않습니다. 기존 측정 기록은 보존되며, 같은 번호로 다시 등록해도 기존 기록은 새 학생과 자동 연결되지 않습니다.`
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
          archived?: boolean;
          teacherStateVersion?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "학생을 보관 처리하지 못했습니다.");
        }

        setItems((currentItems) =>
          sortStudents(currentItems.filter((entry) => entry.id !== student.id))
        );
        if (editingStudentId === student.id) {
          resetForm();
        }
        setMessage("학생을 보관 처리했습니다. 기존 측정 기록은 그대로 보존됩니다.");
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
    <section className="min-w-0 rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">학생 명단</h2>
        <p className="text-sm text-ink/70">반별 학생을 추가하고 명단을 관리합니다. 삭제 대신 보관 처리하여 측정 기록을 보존합니다.</p>
      </div>
      {!sheetConnected ? (
        <div className="mb-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink/80">
          {sheetStatus?.summary ?? "구글 시트를 먼저 연결해주세요."}
        </div>
      ) : null}
      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm">
          학생 이름
          <input
            ref={nameInputRef}
            id="student-name"
            className="min-h-12 rounded-2xl border border-ink/15 px-4 py-3"
            value={name}
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "student-name-error" : undefined}
            onChange={(event) => {
              setName(event.target.value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
            }}
          />
          {fieldErrors.name ? <span id="student-name-error" className="text-sm text-red-700">{fieldErrors.name}</span> : null}
        </label>
        <label className="flex flex-col gap-2 text-sm">
          반
          <select
            className="min-h-12 rounded-2xl border border-ink/15 px-4 py-3"
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
            id="student-number"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="min-h-12 rounded-2xl border border-ink/15 px-4 py-3"
            value={studentNumber}
            aria-invalid={Boolean(fieldErrors.studentNumber)}
            aria-describedby={fieldErrors.studentNumber ? "student-number-error" : undefined}
            onChange={(event) => {
              setStudentNumber(event.target.value);
              setFieldErrors((current) => ({ ...current, studentNumber: undefined }));
            }}
          />
          {fieldErrors.studentNumber ? <span id="student-number-error" className="text-sm text-red-700">{fieldErrors.studentNumber}</span> : null}
        </label>
        <label className="flex flex-col gap-2 text-sm">
          성별
          <select
            className="min-h-12 rounded-2xl border border-ink/15 px-4 py-3"
            value={sex}
            onChange={(event) => setSex(event.target.value as "male" | "female")}
          >
            <option value="female">여학생</option>
            <option value="male">남학생</option>
          </select>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="gi-pulse min-h-11 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={isPending}
          onClick={submitStudent}
        >
          {isPending ? "저장 중…" : editingStudentId ? "학생 수정" : "학생 추가"}
        </button>
        {editingStudentId ? (
          <button
            type="button"
            className="min-h-11 rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium"
            disabled={isPending}
            onClick={resetForm}
          >
            수정 취소
          </button>
        ) : null}
        {message ? <p role="status" aria-live="polite" className="text-sm text-ink/70">{message}</p> : null}
      </div>
      <div className="mt-6 grid min-w-0 gap-3 md:grid-cols-2">
        {visibleItems.length > 0 ? visibleItems.map((student) => (
          <article key={student.id} className="min-w-0 rounded-2xl border border-ink/10 bg-canvas/30 p-4">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold">{student.studentNumber ?? "번호 없음"}번 {student.name}</h3>
                <p className="mt-1 break-words text-sm text-ink/70">
                  {classes.find((entry) => entry.id === student.classId)?.label ?? student.classId} · {student.sex === "female" ? "여학생" : "남학생"}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-ink/70">{student.gradeLevel}학년</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-full border border-ink/15 px-4 py-2 text-sm font-medium disabled:opacity-50"
                onClick={() => startEditingStudent(student)}
                disabled={isPending}
              >{student.name} 수정</button>
              <button
                type="button"
                className="min-h-11 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
                onClick={() => deleteStudent(student)}
                disabled={isPending}
              >{student.name} 보관</button>
            </div>
          </article>
        )) : (
          <p className="rounded-2xl border border-dashed border-ink/15 p-5 text-center text-sm text-ink/60 md:col-span-2">
            선택한 반에 등록된 학생이 아직 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
