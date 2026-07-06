# Student Growth UI Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cumulative PAPS growth easier for students and teachers to understand by adding plain-language trend summaries, month/session labels, bilateral grip-strength trend visualization, and a more discoverable teacher growth report entry.

**Architecture:** Keep the existing `historyAttempts` data flow intact. Add a small pure utility module for growth interpretation, use it from the student instant result card, add a grip-specific chart component that reads existing `detail.kind === "grip-strength"` values, and make the teacher results growth report visible as guided empty state even before a search query is entered.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library, Tailwind CSS.

---

## File Structure

- Create: `src/lib/paps/student-growth-insights.ts`
  - Pure formatting and interpretation helpers for cumulative attempts.
  - No React imports.
- Create: `src/components/charts/grip-strength-bilateral-chart.tsx`
  - Student-facing right/left grip trend chart.
  - Falls back safely when side detail is missing.
- Modify: `src/components/student/instant-result-card.tsx`
  - Use growth insight helper for summary copy, month/session chart labels, and improved "직전 대비" wording.
  - Render grip bilateral chart for `grip-strength` when there is at least one side-specific detail.
- Modify: `src/components/charts/progress-mini-chart.tsx`
  - Allow a clearer title/description and preserve existing default behavior.
- Modify: `src/components/teacher/student-growth-report.tsx`
  - Show a helpful student-growth guidance card when query is empty instead of returning `null`.
- Modify: `src/components/teacher/results-filter-panel.tsx`
  - Clarify that student name search opens the student growth report.
- Test: `tests/paps/student-growth-insights.test.ts`
- Test: `tests/app/student-instant-result-card.test.tsx`
- Test: `tests/app/teacher-results-workspace.test.tsx`

---

### Task 1: Growth Insight Utility

**Files:**
- Create: `src/lib/paps/student-growth-insights.ts`
- Test: `tests/paps/student-growth-insights.test.ts`

- [ ] **Step 1: Write failing tests for growth summaries and labels**

Add `tests/paps/student-growth-insights.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildStudentGrowthInsight,
  formatStudentAttemptChartLabel
} from "../../src/lib/paps/student-growth-insights";
import type { PAPSStudentEventHistoryAttempt } from "../../src/lib/paps/types";

const attempt = (
  id: string,
  measurement: number,
  createdAt: string,
  sessionName: string,
  isCurrentSession: boolean
): PAPSStudentEventHistoryAttempt => ({
  id,
  attemptNumber: 1,
  measurement,
  createdAt,
  sessionId: id.replace("attempt", "session"),
  sessionName,
  sessionType: isCurrentSession ? "official" : "practice",
  eventId: "sit-and-reach",
  academicYear: 2026,
  isCurrentSession
});

describe("student growth insights", () => {
  it("summarizes steady improvement for higher-is-better events", () => {
    const attempts = [
      attempt("attempt-march", 16, "2026-03-10T09:00:00.000Z", "3월 측정", false),
      attempt("attempt-april", 21, "2026-04-10T09:00:00.000Z", "4월 측정", false),
      attempt("attempt-july", 24, "2026-07-07T09:00:00.000Z", "7월 측정", true)
    ];

    expect(
      buildStudentGrowthInsight({
        attempts,
        latestAttemptId: "attempt-july",
        betterDirection: "higher",
        eventLabel: "앉아윗몸앞으로굽히기",
        unit: "cm"
      })
    ).toMatchObject({
      trend: "improving",
      previousDeltaText: "+3 cm",
      overallDeltaText: "+8 cm",
      summary:
        "3월 측정 16 cm에서 7월 측정 24 cm까지 총 +8 cm 변화했고, 직전 기록보다 +3 cm 좋아졌습니다."
    });
  });

  it("summarizes decline for higher-is-better events", () => {
    const attempts = [
      attempt("attempt-march", 24, "2026-03-10T09:00:00.000Z", "3월 측정", false),
      attempt("attempt-april", 21, "2026-04-10T09:00:00.000Z", "4월 측정", false),
      attempt("attempt-july", 20, "2026-07-07T09:00:00.000Z", "7월 측정", true)
    ];

    expect(
      buildStudentGrowthInsight({
        attempts,
        latestAttemptId: "attempt-july",
        betterDirection: "higher",
        eventLabel: "왕복오래달리기",
        unit: "laps"
      })
    ).toMatchObject({
      trend: "declining",
      previousDeltaText: "-1 laps",
      overallDeltaText: "-4 laps"
    });
  });

  it("uses lower-is-better direction for improvement wording", () => {
    const attempts = [
      attempt("attempt-march", 12.8, "2026-03-10T09:00:00.000Z", "3월 측정", false),
      attempt("attempt-july", 11.9, "2026-07-07T09:00:00.000Z", "7월 측정", true)
    ];

    expect(
      buildStudentGrowthInsight({
        attempts,
        latestAttemptId: "attempt-july",
        betterDirection: "lower",
        eventLabel: "50m 달리기",
        unit: "초"
      })
    ).toMatchObject({
      trend: "improving",
      previousDeltaText: "+0.9 초",
      overallDeltaText: "+0.9 초"
    });
  });

  it("formats compact month labels for chart points", () => {
    const attempts = [
      attempt("attempt-march", 16, "2026-03-10T09:00:00.000Z", "3월 측정", false),
      attempt("attempt-april", 21, "2026-04-10T09:00:00.000Z", "4월 측정", false),
      attempt("attempt-july", 24, "2026-07-07T09:00:00.000Z", "7월 측정", true)
    ];

    expect(formatStudentAttemptChartLabel(attempts[0]!, 0, "attempt-july")).toBe("3월");
    expect(formatStudentAttemptChartLabel(attempts[1]!, 1, "attempt-july")).toBe("4월");
    expect(formatStudentAttemptChartLabel(attempts[2]!, 2, "attempt-july")).toBe("이번");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/paps/student-growth-insights.test.ts
```

Expected: FAIL because `src/lib/paps/student-growth-insights.ts` does not exist.

- [ ] **Step 3: Implement the pure helper module**

Create `src/lib/paps/student-growth-insights.ts` with:

```ts
import type { BetterDirection, PAPSAttempt } from "./types";

export type StudentGrowthTrend = "single" | "improving" | "declining" | "mixed" | "same";

export type StudentGrowthInsight = {
  trend: StudentGrowthTrend;
  summary: string;
  previousDeltaText: string | null;
  overallDeltaText: string | null;
};

const formatNumber = (value: number): string =>
  new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 3
  }).format(Number(value.toFixed(3)));

const isHistoryAttempt = (attempt: PAPSAttempt): attempt is PAPSAttempt & { sessionName: string } =>
  "sessionName" in attempt && typeof (attempt as { sessionName?: unknown }).sessionName === "string";

const getAttemptLabel = (attempt: PAPSAttempt, fallbackIndex: number): string => {
  if (isHistoryAttempt(attempt)) {
    return attempt.sessionName;
  }

  return `${fallbackIndex + 1}번째 기록`;
};

const getImprovementValue = ({
  current,
  previous,
  betterDirection
}: {
  current: number;
  previous: number;
  betterDirection: BetterDirection;
}): number => (betterDirection === "higher" ? current - previous : previous - current);

const formatDelta = (value: number, unit: string): string =>
  `${value > 0 ? "+" : ""}${formatNumber(value)} ${unit}`;

const classifyTrend = ({
  attempts,
  latestIndex,
  betterDirection
}: {
  attempts: PAPSAttempt[];
  latestIndex: number;
  betterDirection: BetterDirection;
}): StudentGrowthTrend => {
  if (attempts.length < 2) {
    return "single";
  }

  const latest = attempts[latestIndex];
  const first = attempts[0];

  if (!latest || !first) {
    return "single";
  }

  const overall = getImprovementValue({
    current: latest.measurement,
    previous: first.measurement,
    betterDirection
  });

  if (overall === 0) {
    return "same";
  }

  const pairDirections = attempts.slice(1).map((attempt, index) =>
    Math.sign(
      getImprovementValue({
        current: attempt.measurement,
        previous: attempts[index]!.measurement,
        betterDirection
      })
    )
  );
  const hasUp = pairDirections.some((direction) => direction > 0);
  const hasDown = pairDirections.some((direction) => direction < 0);

  if (overall > 0 && !hasDown) {
    return "improving";
  }

  if (overall < 0 && !hasUp) {
    return "declining";
  }

  return "mixed";
};

export const buildStudentGrowthInsight = ({
  attempts,
  latestAttemptId,
  betterDirection,
  eventLabel: _eventLabel,
  unit
}: {
  attempts: PAPSAttempt[];
  latestAttemptId: string | null;
  betterDirection: BetterDirection;
  eventLabel: string;
  unit: string;
}): StudentGrowthInsight => {
  const latestIndex = latestAttemptId
    ? attempts.findIndex((attempt) => attempt.id === latestAttemptId)
    : attempts.length - 1;
  const safeLatestIndex = latestIndex >= 0 ? latestIndex : attempts.length - 1;
  const latest = attempts[safeLatestIndex] ?? null;
  const first = attempts[0] ?? null;
  const previous = safeLatestIndex > 0 ? attempts[safeLatestIndex - 1] ?? null : null;

  if (!latest || !first || attempts.length < 2 || !previous) {
    return {
      trend: "single",
      summary: "첫 기록입니다. 다음 측정부터 변화 흐름을 함께 확인할 수 있습니다.",
      previousDeltaText: null,
      overallDeltaText: null
    };
  }

  const previousDelta = getImprovementValue({
    current: latest.measurement,
    previous: previous.measurement,
    betterDirection
  });
  const overallDelta = getImprovementValue({
    current: latest.measurement,
    previous: first.measurement,
    betterDirection
  });
  const previousDeltaText = formatDelta(previousDelta, unit);
  const overallDeltaText = formatDelta(overallDelta, unit);
  const firstLabel = getAttemptLabel(first, 0);
  const latestLabel = getAttemptLabel(latest, safeLatestIndex);
  const trend = classifyTrend({
    attempts,
    latestIndex: safeLatestIndex,
    betterDirection
  });

  const previousPhrase =
    previousDelta > 0
      ? `직전 기록보다 ${previousDeltaText} 좋아졌습니다.`
      : previousDelta < 0
        ? `직전 기록보다 ${previousDeltaText.replace("-", "")} 낮아졌습니다.`
        : "직전 기록과 같은 수준입니다.";

  return {
    trend,
    previousDeltaText,
    overallDeltaText,
    summary: `${firstLabel} ${formatNumber(first.measurement)} ${unit}에서 ${latestLabel} ${formatNumber(
      latest.measurement
    )} ${unit}까지 총 ${overallDeltaText} 변화했고, ${previousPhrase}`
  };
};

export const formatStudentAttemptChartLabel = (
  attempt: PAPSAttempt,
  index: number,
  latestAttemptId: string | null
): string => {
  if (attempt.id === latestAttemptId) {
    return "이번";
  }

  if (isHistoryAttempt(attempt)) {
    const monthMatch = attempt.sessionName.match(/(\d{1,2})월/);

    if (monthMatch?.[1]) {
      return `${monthMatch[1]}월`;
    }
  }

  return `${index + 1}번째`;
};
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/paps/student-growth-insights.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/paps/student-growth-insights.ts tests/paps/student-growth-insights.test.ts
git commit -m "feat: add student growth insight helpers"
```

---

### Task 2: Student Instant Result UI

**Files:**
- Create: `src/components/charts/grip-strength-bilateral-chart.tsx`
- Modify: `src/components/charts/progress-mini-chart.tsx`
- Modify: `src/components/student/instant-result-card.tsx`
- Test: `tests/app/student-instant-result-card.test.tsx`

- [ ] **Step 1: Extend instant result tests**

Update `tests/app/student-instant-result-card.test.tsx`:

1. Keep the existing test.
2. Add expectations to the existing cumulative grip-strength test:

```ts
expect(
  screen.getByText(
    "3월 5, 6학년 - 악력 18 kg에서 4월 5, 6학년 - 악력 18 kg까지 총 +0 kg 변화했고, 직전 기록보다 +0.6 kg 좋아졌습니다."
  )
).toBeInTheDocument();
expect(screen.getByText("오른손·왼손 추이")).toBeInTheDocument();
expect(screen.getByText("오른손")).toBeInTheDocument();
expect(screen.getByText("왼손")).toBeInTheDocument();
expect(screen.getByText("3월")).toBeInTheDocument();
expect(screen.getByText("이번")).toBeInTheDocument();
```

3. Add a non-grip test with March, April, July attempts:

```ts
it("shows a plain-language cumulative summary and month labels for non-grip events", () => {
  const historyAttempts: PAPSStudentEventHistoryAttempt[] = [
    {
      id: "attempt-march",
      attemptNumber: 1,
      measurement: 16,
      createdAt: "2026-03-05T09:00:00.000Z",
      sessionId: "session-march",
      sessionName: "3월 측정",
      sessionType: "practice",
      eventId: "sit-and-reach",
      academicYear: 2026,
      isCurrentSession: false
    },
    {
      id: "attempt-april",
      attemptNumber: 1,
      measurement: 21,
      createdAt: "2026-04-05T09:00:00.000Z",
      sessionId: "session-april",
      sessionName: "4월 측정",
      sessionType: "practice",
      eventId: "sit-and-reach",
      academicYear: 2026,
      isCurrentSession: false
    },
    {
      id: "attempt-july",
      attemptNumber: 1,
      measurement: 24,
      createdAt: "2026-07-07T09:00:00.000Z",
      sessionId: "session-july",
      sessionName: "7월 측정",
      sessionType: "official",
      eventId: "sit-and-reach",
      academicYear: 2026,
      isCurrentSession: true
    }
  ];

  render(
    <InstantResultCard
      studentName="김다은"
      sessionType="official"
      eventId="sit-and-reach"
      eventLabel="앉아윗몸앞으로굽히기"
      unit="cm"
      attempts={[historyAttempts[2]!]}
      historyAttempts={historyAttempts}
      betterDirection="higher"
      latestOfficialGrade={3}
    />
  );

  expect(
    screen.getByText(
      "3월 측정 16 cm에서 7월 측정 24 cm까지 총 +8 cm 변화했고, 직전 기록보다 +3 cm 좋아졌습니다."
    )
  ).toBeInTheDocument();
  expect(screen.getByText("3월")).toBeInTheDocument();
  expect(screen.getByText("4월")).toBeInTheDocument();
  expect(screen.getByText("이번")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/app/student-instant-result-card.test.tsx
```

Expected: FAIL because the new summary and bilateral chart do not exist yet.

- [ ] **Step 3: Update chart component defaults**

Modify `src/components/charts/progress-mini-chart.tsx` so props include optional `title` and `description`:

```ts
export function ProgressMiniChart({
  attempts,
  unit,
  getLabel,
  title = "개인 추이",
  description
}: {
  attempts: PAPSAttempt[];
  unit: string;
  getLabel?: (attempt: PAPSAttempt, index: number) => string;
  title?: string;
  description?: string;
}) {
```

Then replace the static title paragraph:

```tsx
<p className="mb-1 text-sm font-medium text-ink/70">{title}</p>
{description ? <p className="mb-3 text-xs text-ink/55">{description}</p> : <div className="mb-3" />}
```

- [ ] **Step 4: Add grip bilateral chart**

Create `src/components/charts/grip-strength-bilateral-chart.tsx`:

```tsx
import React from "react";

import { isGripStrengthMeasurementDetail } from "../../lib/paps/composite-measurements";
import type { PAPSAttempt } from "../../lib/paps/types";

type GripPoint = {
  id: string;
  right: number;
  left: number;
  label: string;
};

const getY = (value: number, minimum: number, range: number): number =>
  92 - ((value - minimum) / range) * 58;

const toPolyline = (
  points: GripPoint[],
  side: "right" | "left",
  minimum: number,
  range: number
): string =>
  points
    .map((point, index) => {
      const x = 24 + (index * 192) / Math.max(points.length - 1, 1);
      const y = getY(point[side], minimum, range);

      return `${x},${y}`;
    })
    .join(" ");

export function GripStrengthBilateralChart({
  attempts,
  getLabel
}: {
  attempts: PAPSAttempt[];
  getLabel: (attempt: PAPSAttempt, index: number) => string;
}) {
  const points: GripPoint[] = attempts.flatMap((attempt, index) => {
    if (!isGripStrengthMeasurementDetail(attempt.detail)) {
      return [];
    }

    return [
      {
        id: attempt.id,
        right: attempt.detail.right,
        left: attempt.detail.left,
        label: getLabel(attempt, index)
      }
    ];
  });

  if (points.length === 0) {
    return null;
  }

  const values = points.flatMap((point) => [point.right, point.left]);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;

  return (
    <div className="rounded-2xl bg-canvas/80 p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-ink/70">오른손·왼손 추이</p>
          <p className="mt-1 text-xs text-ink/55">악력은 양손 최고 흐름을 따로 확인합니다.</p>
        </div>
        <div className="flex gap-2 text-xs font-medium">
          <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">오른손</span>
          <span className="rounded-full bg-ink/10 px-2 py-1 text-ink/70">왼손</span>
        </div>
      </div>
      <svg viewBox="0 0 240 118" className="h-32 w-full" aria-label="오른손 왼손 악력 추이 차트">
        {points.length > 1 ? (
          <>
            <polyline
              fill="none"
              stroke="#b35c2e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={toPolyline(points, "right", minimum, range)}
            />
            <polyline
              fill="none"
              stroke="#14213d"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={toPolyline(points, "left", minimum, range)}
            />
          </>
        ) : null}
        {points.map((point, index) => {
          const x = 24 + (index * 192) / Math.max(points.length - 1, 1);
          const rightY = getY(point.right, minimum, range);
          const leftY = getY(point.left, minimum, range);

          return (
            <g key={point.id}>
              <circle cx={x} cy={rightY} r="5" fill="#b35c2e" />
              <circle cx={x} cy={leftY} r="5" fill="#14213d" />
              <text x={x} y={112} textAnchor="middle" fontSize="10" fill="#14213d">
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

- [ ] **Step 5: Wire insights into instant result card**

Modify `src/components/student/instant-result-card.tsx`:

1. Import:

```ts
import { GripStrengthBilateralChart } from "../charts/grip-strength-bilateral-chart";
import {
  buildStudentGrowthInsight,
  formatStudentAttemptChartLabel
} from "../../lib/paps/student-growth-insights";
```

2. Remove the local `formatChartLabel` helper.
3. After `displayAttempts` and `latestAttempt`, compute:

```ts
const growthInsight = buildStudentGrowthInsight({
  attempts: displayAttempts,
  latestAttemptId: latestAttempt?.id ?? null,
  betterDirection,
  eventLabel,
  unit
});
const chartLabel = (attempt: PAPSAttempt, index: number) =>
  formatStudentAttemptChartLabel(attempt, index, latestAttempt.id);
const hasGripDetailAttempts =
  eventId === "grip-strength" &&
  displayAttempts.some((attempt) => summarizeGripStrengthBilateralBest({ attempts: [attempt] }) !== null);
```

4. Add a summary callout below the header:

```tsx
<div className="mb-4 rounded-2xl border border-accent/15 bg-accent/5 px-4 py-3">
  <p className="text-sm font-medium text-ink">{growthInsight.summary}</p>
</div>
```

5. Replace chart rendering with:

```tsx
{hasGripDetailAttempts ? (
  <GripStrengthBilateralChart attempts={displayAttempts} getLabel={chartLabel} />
) : (
  <ProgressMiniChart
    attempts={displayAttempts}
    unit={unit}
    title="개인 누적 추이"
    description={hasPastSessionHistory ? "지난 세션까지 이어서 봅니다." : undefined}
    getLabel={chartLabel}
  />
)}
```

6. Keep the existing table and "직전 대비" line.

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/app/student-instant-result-card.test.tsx tests/paps/student-growth-insights.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/charts/progress-mini-chart.tsx src/components/charts/grip-strength-bilateral-chart.tsx src/components/student/instant-result-card.tsx tests/app/student-instant-result-card.test.tsx
git commit -m "feat: improve student growth result visuals"
```

---

### Task 3: Teacher Growth Report Discoverability

**Files:**
- Modify: `src/components/teacher/student-growth-report.tsx`
- Modify: `src/components/teacher/results-filter-panel.tsx`
- Test: `tests/app/teacher-results-workspace.test.tsx`

- [ ] **Step 1: Add failing tests for always-visible guidance**

Update `tests/app/teacher-results-workspace.test.tsx` by adding expectations in the render path where no search query is entered:

```ts
expect(screen.getByText("학생별 성장 리포트")).toBeInTheDocument();
expect(
  screen.getByText("학생 이름을 검색하면 종목별 누적 기록과 그래프가 이곳에 표시됩니다.")
).toBeInTheDocument();
expect(
  screen.getByText(/예: 3월, 4월, 7월 기록을 한 학생 기준으로 이어서 확인/)
).toBeInTheDocument();
expect(screen.getByText(/학생명을 입력하면 아래 학생별 성장 리포트가 열립니다/)).toBeInTheDocument();
```

If no suitable existing test has a no-query render, add:

```ts
it("keeps the student growth report discoverable before search", () => {
  render(
    <TeacherResultsWorkspace
      rows={sampleRows}
      filterOptions={sampleFilterOptions}
      initialFailedSyncCount={0}
    />
  );

  expect(screen.getByText("학생별 성장 리포트")).toBeInTheDocument();
  expect(
    screen.getByText("학생 이름을 검색하면 종목별 누적 기록과 그래프가 이곳에 표시됩니다.")
  ).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/app/teacher-results-workspace.test.tsx
```

Expected: FAIL because the growth report currently returns `null` without a query.

- [ ] **Step 3: Keep growth report visible with empty-state guidance**

Modify `src/components/teacher/student-growth-report.tsx`:

```tsx
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
        <span className="w-fit rounded-full bg-canvas px-3 py-1 text-xs font-medium text-ink/60">
          검색 대기 중
        </span>
      </div>
      <div className="mt-4 rounded-[1.5rem] border border-dashed border-accent/25 bg-accent/5 p-4 text-sm text-ink/70">
        예: 3월, 4월, 7월 기록을 한 학생 기준으로 이어서 확인하고, 종목별 성장 흐름을 바로 살펴볼 수 있습니다.
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Clarify filter panel copy**

Modify `src/components/teacher/results-filter-panel.tsx`:

```tsx
<p className="mt-1 text-sm text-ink/70">
  학년, 반, 종목, 세션 유형으로 결과를 빠르게 좁혀 볼 수 있습니다. 학생명을 입력하면 아래 학생별 성장 리포트가 열립니다.
</p>
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/app/teacher-results-workspace.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/teacher/student-growth-report.tsx src/components/teacher/results-filter-panel.tsx tests/app/teacher-results-workspace.test.tsx
git commit -m "feat: surface student growth reports in results"
```

---

### Task 4: Final Verification

**Files:**
- No implementation files unless fixes are required.

- [ ] **Step 1: Run focused verification**

Run:

```bash
npm test -- tests/paps/student-growth-insights.test.ts tests/app/student-instant-result-card.test.tsx tests/app/student-session.test.tsx tests/app/teacher-results-workspace.test.tsx tests/lib/teacher-results-view-model.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run production build**

Run:

```bash
NEXTAUTH_SECRET=test-secret npm run build
```

Expected: PASS.

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

---

## Self-Review

- Spec coverage: The plan implements all three recommended UI improvements: student growth summary, month/session chart labels, bilateral grip visualization, and teacher results discoverability.
- Placeholder scan: No TBD/TODO/later placeholders remain.
- Type consistency: Helper functions use existing `PAPSAttempt`, `PAPSStudentEventHistoryAttempt`, `BetterDirection`, and `EventId` shapes. React components remain in `src/components`.
