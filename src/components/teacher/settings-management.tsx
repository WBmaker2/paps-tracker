"use client";

import React, { useEffect, useState, useTransition } from "react";

import type { GoogleSheetsSetupStatus } from "../../lib/env";
import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import type { PAPSClassroom, PAPSSchool } from "../../lib/paps/types";
import { SettingsClassManagementCard } from "./settings-class-management-card";
import { SettingsSchoolConnectionCard } from "./settings-school-connection-card";
import { SettingsTeacherPinCard } from "./settings-teacher-pin-card";
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
  const [teacherInviteToken, setTeacherInviteToken] = useState("");
  const [inviteTargetEmail, setInviteTargetEmail] = useState("");
  const [issuedInviteToken, setIssuedInviteToken] = useState("");
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
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
  const [isInvitePending, startInviteTransition] = useTransition();
  const serviceAccountMissing = !sheetSetupStatus.serviceAccountConfigured;
  const templateMissing = !sheetSetupStatus.templateConfigured;
  const isSchoolDirty =
    schoolName !== (savedSchoolSettings?.schoolName ?? "") ||
    sheetUrl !== (savedSchoolSettings?.sheetUrl ?? "");
  const isEffectivelySheetConnected = sheetConnected || hasLocallyConnectedSchool;
  const teacherInviteRequired =
    Boolean(pendingSheetClaim) ||
    (!isEffectivelySheetConnected && sheetStatus?.code === "teacher_not_authorized");

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
    setTeacherInviteToken("");
    setSchoolMessage(message);
  };

  const connectSchool = async (inviteToken?: string) => {
    const response = await fetch("/api/google-sheet/connect", {
      method: "POST",
      headers: buildTeacherMutationHeaders({
        "content-type": "application/json"
      }),
      body: JSON.stringify({
        url: sheetUrl,
        schoolName,
        ...(inviteToken ? { teacherInviteToken: inviteToken } : {})
      })
    });
    const payload = (await response.json()) as GoogleSheetConnectionPayload;

    if (!response.ok || !payload.school) {
      if (payload.code === "teacher_not_authorized" && payload.action === "enter_teacher_invite") {
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
      inviteToken
        ? "승인된 기존 시트를 연결하고 현재 교사를 추가했습니다."
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

  const connectWithTeacherInvite = () => {
    if (!sheetUrl.trim()) {
      setSchoolMessage("구글 시트 URL을 먼저 입력해주세요.");
      return;
    }

    if (!teacherInviteToken.trim()) {
      setSchoolMessage("기존 담당교사가 발급한 교사 추가 승인 코드를 입력해주세요.");
      return;
    }

    setSchoolMessage(null);

    startSchoolTransition(async () => {
      try {
        await connectSchool(teacherInviteToken.trim());
      } catch (error) {
        setSchoolMessage(
          error instanceof Error ? error.message : "승인된 기존 시트를 연결하지 못했습니다."
        );
      }
    });
  };

  const issueTeacherInvite = () => {
    const targetEmail = inviteTargetEmail.trim().toLowerCase();

    if (!targetEmail) {
      setInviteMessage("추가할 교사 이메일을 입력해주세요.");
      return;
    }

    setInviteMessage(null);
    setIssuedInviteToken("");

    startInviteTransition(async () => {
      try {
        const response = await fetch("/api/google-sheet/teacher-invite", {
          method: "POST",
          headers: buildTeacherMutationHeaders({
            "content-type": "application/json"
          }),
          body: JSON.stringify({ targetEmail })
        });
        const payload = (await response.json()) as {
          error?: string;
          inviteToken?: string;
          expiresInSeconds?: number;
        };

        if (!response.ok || !payload.inviteToken) {
          throw new Error(payload.error ?? "교사 추가 승인 코드를 만들지 못했습니다.");
        }

        setIssuedInviteToken(payload.inviteToken);
        setInviteMessage("15분 동안 사용할 수 있는 교사 추가 승인 코드를 만들었습니다.");
      } catch (error) {
        setInviteMessage(
          error instanceof Error ? error.message : "교사 추가 승인 코드를 만들지 못했습니다."
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
      <SettingsSchoolConnectionCard
        sheetConnected={isEffectivelySheetConnected}
        sheetStatus={sheetStatus}
        sheetSetupStatus={sheetSetupStatus}
        schoolName={schoolName}
        sheetUrl={sheetUrl}
        schoolMessage={schoolMessage}
        teacherInviteRequired={teacherInviteRequired}
        teacherInviteToken={teacherInviteToken}
        canIssueInvite={Boolean(schoolState && isEffectivelySheetConnected)}
        inviteTargetEmail={inviteTargetEmail}
        issuedInviteToken={issuedInviteToken}
        inviteMessage={inviteMessage}
        isSchoolPending={isSchoolPending}
        isTemplatePending={isTemplatePending}
        isInvitePending={isInvitePending}
        onSchoolNameChange={setSchoolName}
        onSheetUrlChange={setSheetUrl}
        onTeacherInviteTokenChange={setTeacherInviteToken}
        onInviteTargetEmailChange={setInviteTargetEmail}
        onOpenTemplateCopy={openTemplateCopy}
        onConnectWithTeacherInvite={connectWithTeacherInvite}
        onSaveSchool={saveSchool}
        onIssueTeacherInvite={issueTeacherInvite}
      />
      <SettingsTeacherPinCard
        configured={teacherReturnPinConfigured}
        pin={pin}
        pinConfirmation={pinConfirmation}
        message={pinMessage}
        pending={isPinPending}
        onPinChange={setPin}
        onPinConfirmationChange={setPinConfirmation}
        onSave={saveTeacherReturnPin}
        onClear={clearTeacherReturnPin}
      />
      <SettingsClassManagementCard
        classes={classItems}
        gradeLevel={newGradeLevel}
        classNumber={newClassNumber}
        message={classMessage}
        pending={isClassPending}
        onGradeLevelChange={setNewGradeLevel}
        onClassNumberChange={setNewClassNumber}
        onAdd={addClass}
      />
    </div>
  );
}
