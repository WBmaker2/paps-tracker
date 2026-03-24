import React from "react";
import Link from "next/link";

import { hasGoogleOAuthEnv } from "../../../src/lib/env";

const getMissingConfigKeys = (): string[] => {
  const missingKeys: string[] = [];

  if (!hasGoogleOAuthEnv()) {
    missingKeys.push("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
  }

  return missingKeys;
};

export default async function TeacherSignInPage() {
  const isReady = hasGoogleOAuthEnv();
  const missingKeys = getMissingConfigKeys();

  return (
    <main className="min-h-screen bg-canvas px-6 py-12 text-ink sm:px-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 rounded-[2rem] border border-ink/10 bg-white/85 p-8 shadow-panel backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
          Teacher Sign In
        </p>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold">
            {isReady ? "교사 로그인" : "교사 로그인 설정 필요"}
          </h1>
          <p className="text-base leading-7 text-ink/75">
            {isReady
              ? "구글 계정으로 로그인한 뒤 교사 대시보드로 이동합니다."
              : "아직 Google OAuth 설정이 없어 교사 로그인을 시작할 수 없습니다."}
          </p>
        </div>

        {isReady ? (
          <div className="space-y-4">
            <Link
              href="/api/auth/signin/google?callbackUrl=%2Fteacher"
              className="inline-flex w-fit rounded-full bg-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-accent"
            >
              Google로 교사 로그인
            </Link>
            <p className="text-sm text-ink/75">
              추가 승인 목록 없이, 구글 로그인만 완료하면 교사 관리 화면으로 이동합니다.
            </p>
          </div>
        ) : (
          <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold">필요한 환경변수</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink/80">
              {missingKeys.map((key) => (
                <li key={key}>{key}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-ink/75">
              `.env.local`에 값을 넣고 개발 서버를 다시 시작하면 바로 로그인 버튼이 나타납니다.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
