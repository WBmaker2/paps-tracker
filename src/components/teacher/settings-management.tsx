"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { GoogleSheetsSetupStatus } from "../../lib/env";
import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import type { PAPSClassroom, PAPSSchool } from "../../lib/paps/types";
import {
  areSavedSchoolSettingsEqual,
  createSavedSchoolSettings,
  persistSavedSchoolSettings,
  readSavedSchoolSettings,
  type SavedSchoolSettings
} from "./saved-school-settings";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

type ManagedClassroomItem = PAPSClassroom & {
  optimistic?: boolean;
};

type TeacherSettingsSchool = PAPSSchool & {
  teacherReturnPinConfigured?: boolean;
};

type GoogleSheetConnectionPayload = {
  ok?: boolean;
  code?: string;
  action?: string;
  error?: string;
  school?: TeacherSettingsSchool;
  classes?: PAPSClassroom[];
  normalizedUrl?: string;
};

const sortClassItems = <T extends { label: string }>(items: T[]): T[] =>
  items.slice().sort((left, right) => left.label.localeCompare(right.label));

const hasTeacherReturnPin = (school: TeacherSettingsSchool | null): boolean =>
  Boolean(school?.teacherReturnPinConfigured ?? school?.teacherReturnPin);

export function TeacherSettingsManager({
  school,
  classes,
  sheetConnected = true,
  sheetStatus,
  sheetSetupStatus
}: {
  school: TeacherSettingsSchool | null;
  classes: PAPSClassroom[];
  sheetConnected?: boolean;
  sheetStatus?: TeacherSheetStatus;
  sheetSetupStatus: GoogleSheetsSetupStatus;
}) {
  const initialSavedSchoolSettings = createSavedSchoolSettings(school) ?? readSavedSchoolSettings();
  const [schoolState, setSchoolState] = useState(school);
  const [hasLocallyConnectedSchool, setHasLocallyConnectedSchool] = useState(false);
  const [classItems, setClassItems] = useState<ManagedClassroomItem[]>(() => sortClassItems(classes));
  const [savedSchoolSettings, setSavedSchoolSettings] = useState<SavedSchoolSettings | null>(
    initialSavedSchoolSettings
  );
  const [schoolName, setSchoolName] = useState(initialSavedSchoolSettings?.schoolName ?? "");
  const [sheetUrl, setSheetUrl] = useState(initialSavedSchoolSettings?.sheetUrl ?? "");
  const [pendingSheetClaim, setPendingSheetClaim] = useState<{
    schoolName: string;
    sheetUrl: string;
  } | null>(null);
  const [newGradeLevel, setNewGradeLevel] = useState("5");
  const [newClassNumber, setNewClassNumber] = useState("1");
  const [schoolMessage, setSchoolMessage] = useState<string | null>(null);
  const [classMessage, setClassMessage] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [teacherReturnPinConfigured, setTeacherReturnPinConfigured] = useState(() =>
    hasTeacherReturnPin(school)
  );
  const [isSchoolPending, startSchoolTransition] = useTransition();
  const [isTemplatePending, startTemplateTransition] = useTransition();
  const [isClassPending, startClassTransition] = useTransition();
  const [isPinPending, startPinTransition] = useTransition();
  const serviceAccountMissing = !sheetSetupStatus.serviceAccountConfigured;
  const templateMissing = !sheetSetupStatus.templateConfigured;
  const isSchoolDirty =
    schoolName !== (savedSchoolSettings?.schoolName ?? "") ||
    sheetUrl !== (savedSchoolSettings?.sheetUrl ?? "");
  const canClaimExistingSheet =
    Boolean(pendingSheetClaim) || sheetStatus?.code === "teacher_not_authorized";

  const applyConnectedSchool = (payload: GoogleSheetConnectionPayload, message: string) => {
    if (!payload.school) {
      throw new Error(payload.error ?? "구글 시트를 연결하지 못했습니다.");
    }

    const nextSavedSchoolSettings = createSavedSchoolSettings(payload.school, {
      sheetUrl: payload.normalizedUrl ?? payload.school.sheetUrl ?? ""
    });

    setSchoolState(payload.school);
    setHasLocallyConnectedSchool(true);
    if (Array.isArray(payload.classes)) {
      setClassItems(sortClassItems(payload.classes));
    }
    setSavedSchoolSettings(nextSavedSchoolSettings);
    persistSavedSchoolSettings(nextSavedSchoolSettings);
    setSchoolName(nextSavedSchoolSettings?.schoolName ?? "");
    setSheetUrl(nextSavedSchoolSettings?.sheetUrl ?? "");
    setTeacherReturnPinConfigured(hasTeacherReturnPin(payload.school));
    setPendingSheetClaim(null);
    setSchoolMessage(message);
  };

  const connectSchool = async (mode?: "claim_existing_sheet") => {
    const response = await fetch("/api/google-sheet/connect", {
      method: "POST",
      headers: buildTeacherMutationHeaders({
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        url: sheetUrl,
        schoolName,
        ...(mode ? { mode } : {})
      })
    });
    const payload = (await response.json()) as GoogleSheetConnectionPayload;

    if (!response.ok || !payload.school) {
      if (payload.code === "teacher_not_authorized" && payload.action === "claim_existing_sheet") {
        setPendingSheetClaim({
          schoolName,
          sheetUrl
        });
        setSchoolMessage(payload.error ?? "현재 교사가 이 시트에 등록되어 있지 않습니다.");
        return;
      }

      throw new Error(payload.error ?? "구글 시트를 연결하지 못했습니다.");
    }

    applyConnectedSchool(
      payload,
      mode === "claim_existing_sheet"
        ? "기존 시트를 가져오고 현재 교사를 담당교사로 추가했습니다."
        : "학교 정보를 저장했습니다."
    );
  };

  useEffect(() => {
    setClassItems(sortClassItems(classes));
  }, [classes]);

  useEffect(() => {
    const nextSavedSchoolSettings = createSavedSchoolSettings(school) ?? readSavedSchoolSettings();

    if (!school && hasLocallyConnectedSchool) {
      return;
    }

    if (school && hasLocallyConnectedSchool) {
      setHasLocallyConnectedSchool(false);
    }

    setSchoolState(school);
    setTeacherReturnPinConfigured(hasTeacherReturnPin(school));

    if (areSavedSchoolSettingsEqual(savedSchoolSettings, nextSavedSchoolSettings)) {
      return;
    }

    setSavedSchoolSettings(nextSavedSchoolSettings);
    persistSavedSchoolSettings(nextSavedSchoolSettings);

    if (!isSchoolDirty && nextSavedSchoolSettings) {
      setSchoolName(nextSavedSchoolSettings.schoolName);
      setSheetUrl(nextSavedSchoolSettings.sheetUrl);
    }
  }, [hasLocallyConnectedSchool, isSchoolDirty, savedSchoolSettings, school]);

  const saveSchool = () => {
    if (!sheetUrl.trim()) {
      setSchoolMessage("구글 시트 URL을 먼저 입력해주세요.");
      return;
    }

    setSchoolMessage(null);

    startSchoolTransition(async () => {
      try {
        await connectSchool();
      } catch (error) {
        setSchoolMessage(error instanceof Error ? error.message : "학교 정보를 저장하지 못했습니다.");
      }
    });
  };

  const claimExistingSheet = () => {
    if (!sheetUrl.trim()) {
      setSchoolMessage("구글 시트 URL을 먼저 입력해주세요.");
      return;
    }

    setSchoolMessage(null);

    startSchoolTransition(async () => {
      try {
        await connectSchool("claim_existing_sheet");
      } catch (error) {
        setSchoolMessage(
          error instanceof Error ? error.message : "기존 시트를 가져오지 못했습니다."
        );
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
    const gradeLevel = Number(newGradeLevel);
    const classNumber = Number(newClassNumber);

    if (!Number.isFinite(gradeLevel) || !Number.isFinite(classNumber) || classNumber < 1) {
      setClassMessage("학년과 반 번호를 올바르게 입력해주세요.");
      return;
    }

    const optimisticClassId = `optimistic-${gradeLevel}-${classNumber}-${Date.now()}`;
    const optimisticClassroom: ManagedClassroomItem = {
      id: optimisticClassId,
      schoolId: schoolState.id,
      academicYear: new Date().getUTCFullYear(),
      gradeLevel: gradeLevel as PAPSClassroom["gradeLevel"],
      classNumber,
      label: `${gradeLevel}-${classNumber}`,
      active: true,
      optimistic: true
    };

    setClassItems((currentItems) =>
      sortClassItems([
        ...currentItems.filter((entry) => entry.id !== optimisticClassId),
        optimisticClassroom
      ])
    );

    startClassTransition(async () => {
      try {
        const response = await fetch("/api/classes", {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            schoolId: schoolState.id,
            academicYear: new Date().getUTCFullYear(),
            gradeLevel,
            classNumber,
            label: `${gradeLevel}-${classNumber}`,
            active: true
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          classroom?: PAPSClassroom;
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.classroom) {
          throw new Error(payload.error ?? "학급을 추가하지 못했습니다.");
        }

        setClassItems((currentItems) =>
          sortClassItems(
            currentItems
              .filter((entry) => entry.id !== optimisticClassId)
              .concat(payload.classroom!)
          )
        );
        setClassMessage("학급을 추가했습니다.");
        setNewClassNumber("1");
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setClassItems((currentItems) =>
          currentItems.filter((entry) => entry.id !== optimisticClassId)
        );
        setClassMessage(error instanceof Error ? error.message : "학급을 추가하지 못했습니다.");
      }
    });
  };

  const saveTeacherReturnPin = () => {
    if (!schoolState) {
      setPinMessage("학교 정보를 먼저 저장해주세요.");
      return;
    }

    if (!/^\d{4,6}$/.test(pin.trim())) {
      setPinMessage("PIN은 4~6자리 숫자로 입력해주세요.");
      return;
    }

    if (pin.trim() !== pinConfirmation.trim()) {
      setPinMessage("PIN 확인 값이 일치하지 않습니다.");
      return;
    }

    setPinMessage(null);

    startPinTransition(async () => {
      try {
        const response = await fetch("/api/teacher/student-return-pin", {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({
            pin
          })
        });
        const payload = (await response.json()) as {
          error?: string;
          teacherReturnPinConfigured?: boolean;
          teacherStateVersion?: string;
        };

        if (!response.ok || !payload.teacherReturnPinConfigured) {
          throw new Error(payload.error ?? "교사용 PIN을 저장하지 못했습니다.");
        }

        setTeacherReturnPinConfigured(true);
        setPin("");
        setPinConfirmation("");
        setPinMessage("교사 화면 접근 PIN을 저장했습니다.");
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setPinMessage(error instanceof Error ? error.message : "교사용 PIN을 저장하지 못했습니다.");
      }
    });
  };

  const clearTeacherReturnPin = () => {
    if (!schoolState) {
      setPinMessage("학교 정보를 먼저 저장해주세요.");
      return;
    }

    setPinMessage(null);

    startPinTransition(async () => {
      try {
        const response = await fetch("/api/teacher/student-return-pin", {
          method: "DELETE",
          headers: buildTeacherMutationHeaders()
        });
        const payload = (await response.json()) as {
          error?: string;
          teacherReturnPinConfigured?: boolean;
          teacherStateVersion?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "교사용 PIN을 해제하지 못했습니다.");
        }

        setTeacherReturnPinConfigured(false);
        setPin("");
        setPinConfirmation("");
        setPinMessage("교사 화면 접근 PIN을 해제했습니다.");
        notifyTeacherDataRefresh({
          refresh: false,
          nextVersion: payload.teacherStateVersion ?? null
        });
      } catch (error) {
        setPinMessage(error instanceof Error ? error.message : "교사용 PIN을 해제하지 못했습니다.");
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
          {!sheetConnected && sheetStatus && sheetStatus.code !== "not_connected" ? (
            <div className="rounded-2xl border border-rose-200/70 bg-rose-50 px-4 py-3">
              <p className="text-sm font-semibold text-ink">현재 연결 문제</p>
              <p className="mt-1 text-sm text-ink/80">{sheetStatus.summary}</p>
              {sheetStatus.detail ? (
                <p className="mt-2 text-sm text-ink/70">{sheetStatus.detail}</p>
              ) : null}
            </div>
          ) : null}
          {canClaimExistingSheet ? (
            <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink">기존 PAPS 시트 가져오기</p>
                  <p className="mt-1 text-sm leading-6 text-ink/75">
                    이 시트에는 이미 다른 담당교사 정보가 저장되어 있습니다. 선생님이
                    관리하던 기존 시트가 맞다면 현재 로그인한 교사를 담당교사로 추가해
                    계속 사용할 수 있습니다.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-accent/30 bg-white px-5 py-2.5 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={claimExistingSheet}
                  disabled={isSchoolPending}
                >
                  기존 시트 가져오기
                </button>
              </div>
              <p className="mt-3 text-xs leading-5 text-ink/60">
                Google Drive의 파일 소유권을 바꾸는 기능은 아니며, PAPS 앱 안의
                담당교사 목록에 현재 계정을 추가합니다.
              </p>
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
              : sheetStatus?.code === "not_connected"
                ? "위 4단계를 완료한 뒤 학교 정보를 저장하면 학급과 세션을 바로 관리할 수 있습니다."
                : sheetStatus?.detail ??
                  sheetStatus?.summary ??
                  "구글 시트 연결 상태를 다시 확인해 주세요."}
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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">교사 화면 접근 PIN</h2>
            <p className="mt-1 text-sm text-ink/70">
              학생 세션 화면에서 교사 관리 화면으로 돌아갈 때 사용할 PIN을 설정합니다.
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${
              teacherReturnPinConfigured
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-800"
            }`}
          >
            {teacherReturnPinConfigured ? "PIN 설정됨" : "PIN 미설정"}
          </span>
        </div>
        <div className="mt-4 rounded-3xl border border-ink/10 bg-ink/[0.03] px-4 py-4">
          <p className="text-sm leading-6 text-ink/70">
            PIN은 구글 시트에 원문으로 저장하지 않고 해시 형태로 저장합니다. 학생용 공용
            기기에서 선생님만 교사 관리 화면으로 돌아갈 수 있게 하는 간단한 안전장치입니다.
          </p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            새 PIN
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="4~6자리 숫자"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            새 PIN 확인
            <input
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={pinConfirmation}
              onChange={(event) =>
                setPinConfirmation(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="한 번 더 입력"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={saveTeacherReturnPin}
            disabled={isPinPending}
          >
            {teacherReturnPinConfigured ? "PIN 변경" : "PIN 저장"}
          </button>
          {teacherReturnPinConfigured ? (
            <button
              type="button"
              className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
              onClick={clearTeacherReturnPin}
              disabled={isPinPending}
            >
              PIN 해제
            </button>
          ) : null}
          {pinMessage ? <p className="text-sm text-ink/70">{pinMessage}</p> : null}
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
        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
            반(숫자입력)
            <input
              className="rounded-2xl border border-ink/15 px-4 py-3"
              value={newClassNumber}
              onChange={(event) => setNewClassNumber(event.target.value)}
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
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{classroom.label}</p>
                {classroom.optimistic ? (
                  <span className="rounded-full bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
                    저장 중
                  </span>
                ) : null}
              </div>
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
