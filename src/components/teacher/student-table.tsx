"use client";

import React, { useState, useTransition } from "react";

import type { PAPSClassroom, PAPSStudent } from "../../lib/paps/types";

export function StudentTable({
  students,
  classes,
  schoolId
}: {
  students: PAPSStudent[];
  classes: PAPSClassroom[];
  schoolId?: string;
}) {
  const [items, setItems] = useState(students);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [sex, setSex] = useState<"male" | "female">("female");
  const [studentNumber, setStudentNumber] = useState("1");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submitStudent = () => {
    const classroom = classes.find((entry) => entry.id === classId);

    if (!classroom) {
      setMessage("반을 먼저 선택해주세요.");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/students", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
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
        };

        if (!response.ok || !payload.student) {
          throw new Error(payload.error ?? "학생을 저장하지 못했습니다.");
        }

        setItems((currentItems) => [...currentItems, payload.student!]);
        setMessage("학생 명단을 저장했습니다.");
        setName("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "학생을 저장하지 못했습니다.");
      }
    });
  };

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-1">
        <h2 className="text-lg font-semibold">학생 명단</h2>
        <p className="text-sm text-ink/70">반별 학생을 추가하고 현재 로스터를 확인합니다.</p>
      </div>
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
          학생 추가
        </button>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {items.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-3">{student.studentNumber ?? "-"}</td>
                <td className="px-4 py-3 font-medium">{student.name}</td>
                <td className="px-4 py-3">
                  {classes.find((entry) => entry.id === student.classId)?.label ?? student.classId}
                </td>
                <td className="px-4 py-3">{student.sex === "female" ? "여학생" : "남학생"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
