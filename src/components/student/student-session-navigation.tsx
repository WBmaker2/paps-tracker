"use client";

import Link from "next/link";
import React from "react";

import { TeacherReturnAccess } from "./teacher-return-access";

export function StudentSessionNavigation({
  teacherReturnEnabled,
  studentAccessToken,
  className = ""
}: {
  teacherReturnEnabled: boolean;
  studentAccessToken?: string | null;
  className?: string;
}) {
  return (
    <nav
      aria-label="학생 세션 이동"
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
    >
      <Link
        href="/"
        className="inline-flex rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/40 hover:text-accent"
      >
        홈으로 돌아가기
      </Link>
      <TeacherReturnAccess
        enabled={teacherReturnEnabled}
        buttonLabel="교사 관리 화면"
        studentAccessToken={studentAccessToken}
      />
    </nav>
  );
}
