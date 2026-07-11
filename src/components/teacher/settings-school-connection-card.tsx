import React from "react";

import type { GoogleSheetsSetupStatus } from "../../lib/env";
import type { TeacherSheetStatus } from "../../lib/google/sheet-connection-status";
import { LiveStatus } from "../ui/live-status";

type SettingsSchoolConnectionCardProps = {
  sheetConnected: boolean;
  sheetStatus?: TeacherSheetStatus;
  sheetSetupStatus: GoogleSheetsSetupStatus;
  schoolName: string;
  sheetUrl: string;
  schoolMessage: string | null;
  teacherInviteRequired: boolean;
  teacherInviteToken: string;
  canIssueInvite: boolean;
  inviteTargetEmail: string;
  issuedInviteToken: string;
  inviteMessage: string | null;
  isSchoolPending: boolean;
  isTemplatePending: boolean;
  isInvitePending: boolean;
  onSchoolNameChange: (value: string) => void;
  onSheetUrlChange: (value: string) => void;
  onTeacherInviteTokenChange: (value: string) => void;
  onInviteTargetEmailChange: (value: string) => void;
  onOpenTemplateCopy: () => void;
  onConnectWithTeacherInvite: () => void;
  onSaveSchool: () => void;
  onIssueTeacherInvite: () => void;
};

export function SettingsSchoolConnectionCard({
  sheetConnected,
  sheetStatus,
  sheetSetupStatus,
  schoolName,
  sheetUrl,
  schoolMessage,
  teacherInviteRequired,
  teacherInviteToken,
  canIssueInvite,
  inviteTargetEmail,
  issuedInviteToken,
  inviteMessage,
  isSchoolPending,
  isTemplatePending,
  isInvitePending,
  onSchoolNameChange,
  onSheetUrlChange,
  onTeacherInviteTokenChange,
  onInviteTargetEmailChange,
  onOpenTemplateCopy,
  onConnectWithTeacherInvite,
  onSaveSchool,
  onIssueTeacherInvite
}: SettingsSchoolConnectionCardProps) {
  const serviceAccountMissing = !sheetSetupStatus.serviceAccountConfigured;
  const templateMissing = !sheetSetupStatus.templateConfigured;

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">학교 정보</h2>
          <p className="mt-1 text-sm text-ink/70">
            학교명과 구글 시트 연결 정보를 바로 수정합니다.
          </p>
        </div>
        {schoolMessage ? (
          <LiveStatus className="text-sm text-ink/70">{schoolMessage}</LiveStatus>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        <details
          open={!sheetConnected}
          className="rounded-3xl border border-ink/10 bg-ink/[0.03] px-4 py-4"
        >
          <summary className="cursor-pointer font-semibold text-ink">
            {sheetConnected ? "구글 시트 연결 안내 다시 보기" : "구글 시트 최초 연결 안내"}
          </summary>
          <div className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-ink/65">
              템플릿 복사본을 만든 뒤 서비스 계정과 공유하고, 복사본 주소를 연결하면 바로
              사용할 수 있습니다.
            </p>
            <ol className="grid gap-3 text-sm text-ink/80">
              <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-ink">1. 템플릿 시트 복사본 만들기</p>
                    <p className="text-ink/65">원본을 열고 내 Google Drive에 사본을 만듭니다.</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-ink/15 px-5 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={onOpenTemplateCopy}
                    disabled={isTemplatePending || templateMissing}
                  >
                    구글 시트 생성(최초 1회)
                  </button>
                </div>
              </li>
              <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                <p className="font-medium text-ink">2. 서비스 계정을 편집자로 공유</p>
                {sheetSetupStatus.serviceAccountEmail ? (
                  <div className="mt-2 rounded-2xl border border-dashed border-ink/15 bg-ink/[0.02] px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink/55">
                      서비스 계정 이메일
                    </p>
                    <p className="mt-1 break-all font-medium text-ink">
                      {sheetSetupStatus.serviceAccountEmail}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1 text-ink/65">서비스 계정 배포 설정을 먼저 완료해 주세요.</p>
                )}
              </li>
              <li className="rounded-2xl border border-ink/10 bg-white px-4 py-3">
                <p className="font-medium text-ink">3. 사본 URL 입력 후 학교 정보 저장</p>
                <p className="mt-1 text-ink/65">
                  시트 형식과 접근 권한을 검사한 뒤 학교·학급 데이터를 불러옵니다.
                </p>
              </li>
            </ol>
          </div>
        </details>

        {templateMissing || serviceAccountMissing ? (
          <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-ink">배포 설정 확인 필요</p>
            <p className="mt-1 text-sm text-ink/75">
              아래 환경변수가 비어 있어 실제 구글 시트 연결이 막힐 수 있습니다.
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

        {teacherInviteRequired ? (
          <div className="rounded-2xl border border-accent/25 bg-accent/10 px-4 py-4">
            <p className="text-sm font-semibold text-ink">기존 PAPS 시트 승인 코드</p>
            <p className="mt-1 text-sm leading-6 text-ink/75">
              기존 담당교사가 발급한 15분 유효 코드를 입력해야 현재 교사를 추가할 수
              있습니다.
            </p>
            <label className="mt-3 flex flex-col gap-2 text-sm font-medium text-ink">
              교사 추가 승인 코드
              <textarea
                className="min-h-24 rounded-2xl border border-ink/15 bg-white px-4 py-3 font-mono text-xs"
                value={teacherInviteToken}
                onChange={(event) => onTeacherInviteTokenChange(event.target.value)}
                placeholder="기존 담당교사가 전달한 승인 코드"
              />
            </label>
            <button
              type="button"
              className="mt-3 w-fit rounded-full border border-accent/30 bg-white px-5 py-2.5 text-sm font-medium text-accent disabled:cursor-not-allowed disabled:opacity-50"
              onClick={onConnectWithTeacherInvite}
              disabled={isSchoolPending || !teacherInviteToken.trim()}
            >
              승인 코드로 연결
            </button>
            <p className="mt-3 text-xs leading-5 text-ink/60">
              코드는 지정된 이메일과 이 시트에만 사용할 수 있으며 소유권은 변경하지 않습니다.
            </p>
          </div>
        ) : null}

        <label className="flex flex-col gap-2 text-sm">
          학교명
          <input
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={schoolName}
            onChange={(event) => onSchoolNameChange(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          구글 시트 URL
          <input
            className="rounded-2xl border border-ink/15 px-4 py-3"
            value={sheetUrl}
            onChange={(event) => onSheetUrlChange(event.target.value)}
          />
        </label>
        <p className="text-sm text-ink/65">
          {sheetConnected
            ? "현재 연결된 시트를 다시 검증하고 학교 정보를 갱신합니다."
            : sheetStatus?.code === "not_connected"
              ? "최초 연결 안내를 완료한 뒤 학교 정보를 저장해 주세요."
              : sheetStatus?.detail ?? sheetStatus?.summary ?? "구글 시트 연결 상태를 확인해 주세요."}
        </p>
        <button
          type="button"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onSaveSchool}
          disabled={isSchoolPending}
        >
          {isSchoolPending ? "저장 중..." : "학교 정보 저장"}
        </button>

        {canIssueInvite ? (
          <details className="rounded-2xl border border-ink/10 bg-ink/[0.02] px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              담당교사 추가 승인 코드 만들기
            </summary>
            <div className="mt-4 space-y-3">
              <p className="text-sm leading-6 text-ink/70">
                추가할 교사 이메일 전용 코드를 만들어 전달하세요. 코드는 15분 뒤 만료됩니다.
              </p>
              <label className="flex flex-col gap-2 text-sm font-medium text-ink">
                추가할 교사 이메일
                <input
                  type="email"
                  autoComplete="email"
                  className="rounded-2xl border border-ink/15 bg-white px-4 py-3"
                  value={inviteTargetEmail}
                  onChange={(event) => onInviteTargetEmailChange(event.target.value)}
                  placeholder="teacher@school.example.com"
                />
              </label>
              <button
                type="button"
                className="rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onIssueTeacherInvite}
                disabled={isInvitePending}
              >
                {isInvitePending ? "승인 코드 만드는 중..." : "교사 추가 승인 코드 만들기"}
              </button>
              {issuedInviteToken ? (
                <label className="flex flex-col gap-2 text-sm font-medium text-ink">
                  발급된 승인 코드
                  <textarea
                    readOnly
                    className="min-h-24 rounded-2xl border border-ink/15 bg-white px-4 py-3 font-mono text-xs"
                    value={issuedInviteToken}
                  />
                </label>
              ) : null}
              {inviteMessage ? (
                <LiveStatus className="text-sm text-ink/70">{inviteMessage}</LiveStatus>
              ) : null}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
