# Grip Strength Bilateral Representatives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 악력 기록을 오른쪽/왼쪽으로 나누어 입력하고, 학생별 악력 대표값을 오른쪽 최고값과 왼쪽 최고값으로 각각 표시한다.

**Architecture:** 기존 `measurement` 숫자 필드는 호환용 대표 숫자로 유지하고, 악력 좌우 원자료는 `PAPSMeasurementDetail`의 새 `grip-strength` detail에 저장한다. 공식 등급/기존 차트와 시트의 단일 `원측정값`은 우선 좌우 중 높은 값으로 유지하되, 악력 결과 UI와 요약 문구는 detail에서 오른쪽 최고값/왼쪽 최고값을 계산해 표시한다. Google Sheets 컬럼은 변경하지 않고 기존 `비고` JSON detail round-trip을 활용한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Google Sheets API adapter.

---

## File Map

- Modify: `src/lib/paps/types.ts`
  - `GripStrengthMeasurementDetail` 타입을 추가하고 `PAPSMeasurementDetail` union에 포함한다.
- Modify: `src/lib/paps/composite-measurements.ts`
  - 악력 detail type guard, parser, derived `measurement`, detail summary, 좌우 최고값 helper를 추가한다.
- Modify: `src/lib/paps/validation.ts`
  - `grip-strength` 제출은 좌우 detail을 요구하도록 검증한다.
- Modify: `src/components/student/record-form.tsx`
  - 악력 종목에서 단일 숫자 입력 대신 오른쪽/왼쪽 숫자 입력을 표시하고 edit prefill을 지원한다.
- Modify: `src/components/student/instant-result-card.tsx`
  - 악력 결과 카드에서 오른쪽 최고값/왼쪽 최고값을 별도로 표시하고 표의 세부 기록을 노출한다.
- Modify as needed: `src/lib/google/sheet-record-persistence.ts`
  - 시트에서 복원한 attempt가 `detail`을 잃지 않는지 확인하고 필요 시 보존한다.
- Test: `tests/paps/composite-measurements.test.ts`
- Test: `tests/paps/validation.test.ts`
- Test: `tests/app/student-session.test.tsx` or `tests/app/student-submit-sheets.test.ts`
- Test: `tests/app/student-instant-result-card.test.tsx`
- Test: `tests/google/sheet-record-persistence.test.ts` or `tests/google/sheet-record-artifacts.test.ts`

---

### Task 1: 악력 좌우 detail 도메인 모델과 입력 검증

**Files:**
- Modify: `src/lib/paps/types.ts`
- Modify: `src/lib/paps/composite-measurements.ts`
- Modify: `src/lib/paps/validation.ts`
- Test: `tests/paps/composite-measurements.test.ts`
- Test: `tests/paps/validation.test.ts`

- [ ] **Step 1: Write failing tests for grip-strength detail parsing and measurement derivation**

Add tests that prove:
- `{ kind: "grip-strength", right: 18, left: 17.4 }` parses as `PAPSMeasurementDetail`.
- `resolveSubmissionMeasurement({ eventId: "grip-strength", detail })` returns `measurement: 18` and preserves detail.
- invalid negative/non-numeric side values are rejected.
- numeric-only `grip-strength` submission is rejected by `assertMeasurementDetailAllowed`.

Run:

```bash
npm test -- tests/paps/composite-measurements.test.ts tests/paps/validation.test.ts
```

Expected before implementation: FAIL because the grip detail type guard and validation do not exist.

- [ ] **Step 2: Add `GripStrengthMeasurementDetail` type**

Add this type in `src/lib/paps/types.ts`:

```ts
export interface GripStrengthMeasurementDetail {
  kind: "grip-strength";
  right: number;
  left: number;
}
```

Update:

```ts
export type PAPSMeasurementDetail =
  | StepTestMeasurementDetail
  | ComprehensiveFlexibilityMeasurementDetail
  | GripStrengthMeasurementDetail;
```

- [ ] **Step 3: Implement grip-strength parser and derived measurement**

In `src/lib/paps/composite-measurements.ts`, add:

```ts
const isValidGripStrengthValue = (value: unknown): value is number =>
  Number.isFinite(value) && Number(value) >= 0 && Number(value) <= 200;

export const isGripStrengthMeasurementDetail = (
  value: unknown
): value is GripStrengthMeasurementDetail =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as { kind?: unknown }).kind === "grip-strength" &&
      isValidGripStrengthValue((value as { right?: unknown }).right) &&
      isValidGripStrengthValue((value as { left?: unknown }).left)
  );
```

Extend `parseMeasurementDetail()` to return the right/left values. Extend `deriveCompositeMeasurement()` and `resolveSubmissionMeasurement()` so `eventId === "grip-strength"` requires detail and returns `measurement: Math.max(detail.right, detail.left)`.

- [ ] **Step 4: Add grip-strength detail summary**

Extend `formatAttemptDetailSummary()`:

```ts
if (eventId === "grip-strength" && isGripStrengthMeasurementDetail(detail)) {
  return `오른쪽 ${detail.right}kg · 왼쪽 ${detail.left}kg`;
}
```

- [ ] **Step 5: Require grip-strength detail in validation**

In `src/lib/paps/validation.ts`, import `isGripStrengthMeasurementDetail` and add:

```ts
if (eventId === "grip-strength" && !isGripStrengthMeasurementDetail(detail)) {
  throw new Error("악력은 오른쪽과 왼쪽 기록을 모두 입력해 주세요.");
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/paps/composite-measurements.test.ts tests/paps/validation.test.ts
```

Expected: PASS.

---

### Task 2: 학생 악력 입력 UI와 즉시 결과 표시

**Files:**
- Modify: `src/components/student/record-form.tsx`
- Modify: `src/components/student/instant-result-card.tsx`
- Test: `tests/app/student-session.test.tsx`
- Test: `tests/app/student-instant-result-card.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Add/extend tests that prove:
- 악력 선택 시 `오른쪽 악력`과 `왼쪽 악력` 입력칸이 보인다.
- 한쪽만 입력하면 제출하지 않고 안내 문구가 나온다.
- 양쪽 입력 후 제출 payload는 `{ detail: { kind: "grip-strength", right, left } }` 이다.
- 즉시 결과 카드가 누적 악력 detail에서 `오른쪽 대표 18kg`과 `왼쪽 대표 17.4kg`을 표시한다.

Run:

```bash
npm test -- tests/app/student-session.test.tsx tests/app/student-instant-result-card.test.tsx
```

Expected before implementation: FAIL because the UI still has one numeric 악력 input.

- [ ] **Step 2: Add grip input state**

In `src/components/student/record-form.tsx`, add state:

```ts
const [gripStrength, setGripStrength] = useState({ right: "", left: "" });
```

Initialize from `initialSubmission.detail?.kind === "grip-strength"`.

- [ ] **Step 3: Submit grip-strength detail**

Before the generic measurement branch in `handleSubmit`, add:

```ts
if (eventId === "grip-strength") {
  const right = Number(gripStrength.right);
  const left = Number(gripStrength.left);

  if (!gripStrength.right.trim() || !gripStrength.left.trim()) {
    setLocalError("오른쪽과 왼쪽 악력을 모두 입력해 주세요.");
    return;
  }

  if (!Number.isFinite(right) || !Number.isFinite(left)) {
    setLocalError("악력은 숫자로 입력해 주세요.");
    return;
  }

  setLocalError(null);
  await onSubmit({
    detail: {
      kind: "grip-strength",
      right,
      left
    }
  });
  return;
}
```

- [ ] **Step 4: Render two grip inputs**

Render two number inputs for `eventId === "grip-strength"` with labels:
- `오른쪽 악력`
- `왼쪽 악력`

The generic single measurement input should render only when the event is not `step-test`, `comprehensive-flexibility`, or `grip-strength`.

- [ ] **Step 5: Add bilateral representative display**

In `src/components/student/instant-result-card.tsx`, use a helper from `composite-measurements.ts` to calculate:

```ts
{ rightBest: 18, leftBest: 17.4 }
```

Display it in the result card for `eventId === "grip-strength"`:

```text
오른쪽 대표 18kg · 왼쪽 대표 17.4kg
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/app/student-session.test.tsx tests/app/student-instant-result-card.test.tsx
```

Expected: PASS.

---

### Task 3: Google Sheets round-trip and teacher/result compatibility

**Files:**
- Modify: `src/lib/google/sheet-record-persistence.ts` if detail is dropped during persistence.
- Modify: `src/lib/google/sheet-derived-tab-payloads.ts` if summary notes need the bilateral representative string.
- Test: `tests/google/sheet-record-persistence.test.ts`
- Test: `tests/google/sheet-record-artifacts.test.ts`
- Test: `tests/google/sheet-derived-tab-payloads.test.ts`

- [ ] **Step 1: Write failing Google Sheets tests**

Add/extend tests that prove:
- A grip-strength attempt note containing detail JSON round-trips back into `PAPSStoredAttempt.detail`.
- Derived `세션기록` rows include human-readable `오른쪽 ... · 왼쪽 ...` in `비고`.
- Student/official summary note for grip-strength can include `오른쪽 대표 ... · 왼쪽 대표 ...` without changing sheet headers.

Run:

```bash
npm test -- tests/google/sheet-record-persistence.test.ts tests/google/sheet-record-artifacts.test.ts tests/google/sheet-derived-tab-payloads.test.ts
```

Expected before implementation: FAIL if detail is dropped or summaries omit grip detail.

- [ ] **Step 2: Preserve detail in sheet record persistence**

If `buildAttemptRecordsForSession()` or equivalent reconstruction drops detail, include:

```ts
detail: attempt.detail ?? null
```

when pushing `record.attempts`.

- [ ] **Step 3: Add bilateral representative note to derived summaries**

Use the bilateral helper for `eventId === "grip-strength"` and include the result in `학생요약`/`공식평가요약` note/message when possible:

```text
오른쪽 대표 18kg · 왼쪽 대표 17.4kg
```

Do not change `PAPS_GOOGLE_SHEET_PROTOTYPE_TABS` headers in this task.

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/google/sheet-record-persistence.test.ts tests/google/sheet-record-artifacts.test.ts tests/google/sheet-derived-tab-payloads.test.ts
```

Expected: PASS.

---

### Task 4: Full regression

**Files:**
- No new files unless tests reveal a focused fix.

- [ ] **Step 1: Run targeted regression**

Run:

```bash
npm test -- tests/paps/composite-measurements.test.ts tests/paps/validation.test.ts tests/app/student-session.test.tsx tests/app/student-instant-result-card.test.tsx tests/google/sheet-record-persistence.test.ts tests/google/sheet-record-artifacts.test.ts tests/google/sheet-derived-tab-payloads.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full validation**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 3: Manual sanity check**

If local dev server/browser verification is available, confirm:
- A grip-strength session shows right/left inputs.
- Submitting multiple attempts shows separate right/left representatives.
- Non-grip events still use the previous single-input UI.

---

## Self-Review Notes

- Spec coverage: 좌우 입력, 좌우 원자료 저장, 오른쪽 최고 대표값, 왼쪽 최고 대표값, 기존 구조 최소 변경, 시트 헤더 유지가 모두 포함되었다.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: `GripStrengthMeasurementDetail.kind` is consistently `"grip-strength"` and all detail helpers use the same shape.
