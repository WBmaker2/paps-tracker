"use client";

import React from "react";

import type { TeacherStudentGrowthReportView } from "../../lib/teacher-results";
import { StudentGrowthEventCard } from "./student-growth-event-card";

export function StudentGrowthReport({
  query,
  report,
  candidates,
  selectedStudentId,
  onSelectStudent
}: {
  query: string;
  report: TeacherStudentGrowthReportView | null;
  candidates: TeacherStudentGrowthReportView[];
  selectedStudentId: string | null;
  onSelectStudent: (studentId: string) => void;
}) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return (
      <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
              Student Growth
            </p>
            <h2 className="mt-1 text-lg font-semibold">학생별 성장 리포트</h2>
            <p className="mt-1 text-sm text-ink/70">
              학생 이름을 검색하면 종목별 누적 기록과 그래프가 이곳에 표시됩니다.
            </p>
          </div>
          <span className="w-fit rounded-full bg-ink/5 px-3 py-1 text-xs font-medium text-ink/70">
            검색 대기 중
          </span>
        </div>
        <p className="mt-4 rounded-[1.5rem] border border-dashed border-ink/15 bg-canvas/40 p-4 text-sm text-ink/70">
          예: 3월, 4월, 7월 기록을 한 학생 기준으로 이어서 확인하면 월별 증가 추이를
          한 번에 볼 수 있습니다.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.75rem] border border-ink/10 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">
            Student Growth
          </p>
          <h2 className="mt-1 text-lg font-semibold">학생별 성장 리포트</h2>
          <p className="mt-1 text-sm text-ink/70">
            검색한 학생의 종목별 기록을 지난 세션까지 모아 표와 그래프로 보여줍니다.
          </p>
        </div>
        {report ? (
          <span className="w-fit rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {report.events.length}개 종목
          </span>
        ) : null}
      </div>

      {candidates.length > 1 ? (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink/75">
            같은 검색어에 여러 학생이 있습니다. 확인할 학생을 선택해 주세요.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidates.map((candidate) => {
              const active = selectedStudentId === candidate.studentId;

              return (
                <button
                  key={candidate.studentId}
                  type="button"
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                    active
                      ? "border-accent/40 bg-accent/10 text-accent"
                      : "border-ink/15 bg-white text-ink"
                  }`}
                  onClick={() => onSelectStudent(candidate.studentId)}
                >
                  {candidate.studentName} · {candidate.classLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {report ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[1.5rem] border border-ink/10 bg-canvas/50 p-4">
            <h3 className="text-xl font-semibold">
              {report.studentName} · {report.classLabel}
            </h3>
            <p className="mt-1 text-sm text-ink/65">
              번호 {report.studentNumber ?? "-"}번 · {report.gradeLevel}학년
            </p>
          </div>
          {report.events.map((event) => (
            <StudentGrowthEventCard key={event.eventId} event={event} />
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-[1.5rem] border border-dashed border-ink/15 bg-canvas/40 p-4 text-sm text-ink/70">
          검색어와 일치하는 학생 기록이 아직 없습니다.
        </p>
      )}
    </section>
  );
}
