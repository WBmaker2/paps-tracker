"use client";

import React, { useState, useTransition } from "react";

import type { PAPSClassroom, PAPSSchool } from "../../lib/paps/types";

export function TeacherSettingsManager({
  school,
  classes,
  sheetConnected = true
}: {
  school: PAPSSchool | null;
  classes: PAPSClassroom[];
  sheetConnected?: boolean;
}) {
  const [schoolState, setSchoolState] = useState(school);
  const [classItems, setClassItems] = useState(classes);
  const [schoolName, setSchoolName] = useState(school?.name ?? "");
  const [sheetUrl, setSheetUrl] = useState(school?.sheetUrl ?? "");
  const [newGradeLevel, setNewGradeLevel] = useState("5");
  const [newClassNumber, setNewClassNumber] = useState("1");
  const [newClassLabel, setNewClassLabel] = useState("");
  const [schoolMessage, setSchoolMessage] = useState<string | null>(null);
  const [classMessage, setClassMessage] = useState<string | null>(null);
  const [isSchoolPending, startSchoolTransition] = useTransition();
  const [isClassPending, startClassTransition] = useTransition();

  const saveSchool = () => {
    if (!sheetUrl.trim()) {
      setSchoolMessage("구글 시트 URL을 먼저 입력해주세요.");
      return;
    }

    setSchoolMessage(null);

    startSchoolTransition(async () => {
      try {
        const response = await fetch("/api/google-sheet/connect", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            url: sheetUrl,
            schoolName
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          school?: PAPSSchool;
          normalizedUrl?: string;
        };

        if (!response.ok || !payload.school) {
          throw new Error(payload.error ?? "구글 시트를 연결하지 못했습니다.");
        }

        setSchoolState(payload.school);
        setSchoolName(payload.school.name);
        setSheetUrl(payload.normalizedUrl ?? payload.school.sheetUrl ?? "");
        setSchoolMessage("학교 정보를 저장했습니다.");
      } catch (error) {
        setSchoolMessage(error instanceof Error ? error.message : "학교 정보를 저장하지 못했습니다.");
      }
    });
  };

  const addClass = () => {
    if (!schoolState) {
      setClassMessage("학교를 먼저 저장해주세요.");
      return;
    }

    setClassMessage(null);

    startClassTransition(async () => {
      try {
        const gradeLevel = Number(newGradeLevel);
        const classNumber = Number(newClassNumber);
        const response = await fetch("/api/classes", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            schoolId: schoolState.id,
            academicYear: new Date().getUTCFullYear(),
            gradeLevel,
            classNumber,
            label: newClassLabel || `${gradeLevel}-${classNumber}`,
            active: true
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          classroom?: PAPSClassroom;
        };

        if (!response.ok || !payload.classroom) {
          throw new Error(payload.error ?? "학급을 추가하지 못했습니다.");
        }

        setClassItems((currentItems) =>
          [...currentItems, payload.classroom!].sort((left, right) => left.label.localeCompare(right.label))
        );
        setClassMessage("학급을 추가했습니다.");
        setNewClassLabel("");
        setNewClassNumber("1");
      } catch (error) {
        setClassMessage(error instanceof Error ? error.message : "학급을 추가하지 못했습니다.");
      }
    });
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">학교 정보</h2>
            <p className="mt-1 text-sm text-ink/70">
              학교명과 구글 시트 연결 정보를 바로 수정합니다.
            </p>
          </div>
          {schoolMessage ? <p className="text-sm text-ink/70">{schoolMessage}</p> : null}
        </div>
        <div className="mt-4 space-y-4">
          <label className="flex flex-col gap-2 text-sm">
            학교명
            <input
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            구글 시트 URL
            <input
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={sheetUrl}
              onChange={(event) => setSheetUrl(event.target.value)}
            />
          </label>
          <p className="text-sm text-ink/65">
            {sheetConnected
              ? "현재 연결된 시트를 다시 검증하고 학교 정보를 갱신합니다."
              : "먼저 템플릿을 복사한 구글 시트를 연결해야 학급과 세션을 관리할 수 있습니다."}
          </p>
          <button
            type="button"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
            onClick={saveSchool}
            disabled={isSchoolPending}
          >
            학교 정보 저장
          </button>
        </div>
      </section>
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">학급 관리</h2>
            <p className="mt-1 text-sm text-ink/70">새 학급을 추가하고 현재 학급 편성을 확인합니다.</p>
          </div>
          {classMessage ? <p className="text-sm text-ink/70">{classMessage}</p> : null}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm">
            새 학급 학년
            <select
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={newGradeLevel}
              onChange={(event) => setNewGradeLevel(event.target.value)}
            >
              {[3, 4, 5, 6].map((gradeLevel) => (
                <option key={gradeLevel} value={gradeLevel}>
                  {gradeLevel}학년
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm">
            새 학급 반 번호
            <input
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={newClassNumber}
              onChange={(event) => setNewClassNumber(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            새 학급 이름
            <input
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={newClassLabel}
              onChange={(event) => setNewClassLabel(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium"
            onClick={addClass}
            disabled={isClassPending}
          >
            학급 추가
          </button>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {classItems.map((classroom) => (
            <article key={classroom.id} className="rounded-2xl border border-ink/10 px-4 py-3">
              <p className="font-medium">{classroom.label}</p>
              <p className="mt-1 text-sm text-ink/65">
                {classroom.gradeLevel}학년 · {classroom.academicYear}학년도
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
