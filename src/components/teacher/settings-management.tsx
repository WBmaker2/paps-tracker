"use client";

import React, { useState, useTransition } from "react";

import type { GoogleSheetsSetupStatus } from "../../lib/env";
import type { PAPSClassroom, PAPSSchool } from "../../lib/paps/types";

export function TeacherSettingsManager({
  school,
  classes,
  sheetConnected = true,
  sheetSetupStatus
}: {
  school: PAPSSchool | null;
  classes: PAPSClassroom[];
  sheetConnected?: boolean;
  sheetSetupStatus: GoogleSheetsSetupStatus;
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
  const [isTemplatePending, startTemplateTransition] = useTransition();
  const [isClassPending, startClassTransition] = useTransition();
  const serviceAccountMissing = !sheetSetupStatus.serviceAccountConfigured;
  const templateMissing = !sheetSetupStatus.templateConfigured;

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

  const openTemplateCopy = () => {
    setSchoolMessage(null);

    startTemplateTransition(async () => {
      try {
        const response = await fetch("/api/google-sheet/template", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({})
        });
        const payload = (await response.json()) as {
          error?: string;
          serviceAccountEmail?: string | null;
          template?: {
            copyUrl?: string;
          };
        };

        if (!response.ok || !payload.template?.copyUrl) {
          throw new Error(payload.error ?? "구글 시트 템플릿을 열지 못했습니다.");
        }

        window.open(payload.template.copyUrl, "_blank", "noopener,noreferrer");
        setSchoolMessage(
          payload.serviceAccountEmail
            ? `새 탭에서 템플릿 복사 화면을 열었습니다. 복사 후 ${payload.serviceAccountEmail} 계정과 시트를 공유한 다음, 복사한 시트 URL을 아래에 붙여넣으세요.`
            : "새 탭에서 템플릿 복사 화면을 열었습니다. 복사한 시트 URL을 아래에 붙여넣고, 서비스 계정 공유 안내를 확인한 뒤 학교 정보를 저장하세요."
        );
      } catch (error) {
        setSchoolMessage(
          error instanceof Error ? error.message : "구글 시트 템플릿을 열지 못했습니다."
        );
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
          <div className="rounded-3xl border border-ink/10 bg-ink/[0.03] px-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-ink">구글 시트 연결 안내</h3>
                  <p className="text-sm text-ink/65">
                    선생님은 템플릿 복사본을 만든 뒤 서비스 계정과 공유하고, 복사본 주소를
                    연결하면 바로 사용을 시작할 수 있습니다.
                  </p>
                </div>
                <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-medium text-ink/70">
                  {sheetConnected ? "연결 완료" : "설정 진행 중"}
                </span>
              </div>
              <ol className="grid gap-3 text-sm text-ink/80">
                <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                      <p className="font-medium text-ink">1단계. 템플릿 시트 복사본 만들기</p>
                      <p className="text-ink/65">
                        <span className="font-medium">구글 시트 생성(최초 1회)</span> 버튼으로
                        원본 시트를 열고, 내 드라이브에 사본을 만듭니다.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={openTemplateCopy}
                      disabled={isTemplatePending || templateMissing}
                    >
                      구글 시트 생성(최초 1회)
                    </button>
                  </div>
                </li>
                <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <div className="space-y-2">
                    <p className="font-medium text-ink">2단계. 서비스 계정과 시트 공유</p>
                    {sheetSetupStatus.serviceAccountEmail ? (
                      <>
                        <p className="text-ink/65">
                          복사한 구글 시트의 `공유` 버튼을 눌러 아래 이메일을 `편집자`로
                          추가하세요.
                        </p>
                        <div className="rounded-2xl border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-3">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink/55">
                            서비스 계정 이메일
                          </p>
                          <p className="mt-1 break-all font-medium text-ink">
                            {sheetSetupStatus.serviceAccountEmail}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-ink/65">
                        서비스 계정 이메일이 아직 배포에 설정되지 않았습니다. 아래 경고를
                        해결한 뒤 다시 시도해 주세요.
                      </p>
                    )}
                  </div>
                </li>
                <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <p className="font-medium text-ink">3단계. 복사한 시트 URL 붙여넣기</p>
                  <p className="mt-1 text-ink/65">
                    사본 만들기가 끝나면 복사본의 주소를 아래
                    <span className="font-medium"> 구글 시트 URL </span>
                    칸에 붙여넣습니다.
                  </p>
                </li>
                <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                  <p className="font-medium text-ink">4단계. 연결 확인 후 저장</p>
                  <p className="mt-1 text-ink/65">
                    <span className="font-medium">학교 정보 저장</span>을 누르면 시트 형식과
                    접근 권한을 검사하고 연결 상태를 갱신합니다.
                  </p>
                </li>
              </ol>
            </div>
          </div>
          {templateMissing || serviceAccountMissing ? (
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-ink">배포 설정 확인 필요</p>
              <p className="mt-1 text-sm text-ink/75">
                현재 배포에서 아래 환경변수가 비어 있어 실제 구글 시트 연결이 막힐 수 있습니다.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {sheetSetupStatus.missingKeys.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-amber-300/70 bg-white px-3 py-1 text-xs font-medium text-ink/80"
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
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
              : "위 4단계를 완료한 뒤 학교 정보를 저장하면 학급과 세션을 바로 관리할 수 있습니다."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
              onClick={saveSchool}
              disabled={isSchoolPending}
            >
              학교 정보 저장
            </button>
          </div>
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
