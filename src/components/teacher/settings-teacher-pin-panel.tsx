"use client";

import React, { useState, useTransition } from "react";

import { SettingsTeacherPinCard } from "./settings-teacher-pin-card";
import { buildTeacherMutationHeaders, notifyTeacherDataRefresh } from "./teacher-data-refresh";

export function SettingsTeacherPinPanel({ available, initialConfigured }: { available: boolean; initialConfigured: boolean }) {
  const [configured, setConfigured] = useState(initialConfigured);
  const [pin, setPin] = useState("");
  const [pinConfirmation, setPinConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!available) return setMessage("학교 정보를 먼저 연결해주세요.");
    if (!/^\d{4,6}$/.test(pin.trim())) return setMessage("PIN은 4~6자리 숫자로 입력해주세요.");
    if (pin.trim() !== pinConfirmation.trim()) return setMessage("PIN 확인 값이 일치하지 않습니다.");
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/student-return-pin", {
          method: "POST",
          headers: buildTeacherMutationHeaders({ "content-type": "application/json" }),
          body: JSON.stringify({ pin })
        });
        const payload = (await response.json()) as { error?: string; teacherReturnPinConfigured?: boolean; teacherStateVersion?: string };
        if (!response.ok || !payload.teacherReturnPinConfigured) throw new Error(payload.error ?? "교사용 PIN을 저장하지 못했습니다.");
        setConfigured(true);
        setPin(""); setPinConfirmation("");
        setMessage("교사 화면 접근 PIN을 저장했습니다.");
        notifyTeacherDataRefresh({ refresh: false, nextVersion: payload.teacherStateVersion ?? null });
      } catch (error) { setMessage(error instanceof Error ? error.message : "교사용 PIN을 저장하지 못했습니다."); }
    });
  };

  const clear = () => {
    if (!available) return setMessage("학교 정보를 먼저 연결해주세요.");
    setMessage(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/teacher/student-return-pin", { method: "DELETE", headers: buildTeacherMutationHeaders() });
        const payload = (await response.json()) as { error?: string; teacherStateVersion?: string };
        if (!response.ok) throw new Error(payload.error ?? "교사용 PIN을 해제하지 못했습니다.");
        setConfigured(false); setPin(""); setPinConfirmation("");
        setMessage("교사 화면 접근 PIN을 해제했습니다.");
        notifyTeacherDataRefresh({ refresh: false, nextVersion: payload.teacherStateVersion ?? null });
      } catch (error) { setMessage(error instanceof Error ? error.message : "교사용 PIN을 해제하지 못했습니다."); }
    });
  };

  return <SettingsTeacherPinCard configured={configured} pin={pin} pinConfirmation={pinConfirmation} message={message} pending={pending} onPinChange={setPin} onPinConfirmationChange={setPinConfirmation} onSave={save} onClear={clear} />;
}
