# Teacher Results Summary Preview + XLSX Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사 결과 화면에서 `학생요약`도 표로 바로 보여주고, 기존 CSV 다운로드를 유지하면서 `XLSX 다운로드`까지 제공한다.

**Architecture:** 현재 [teacher results page](/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx)가 만드는 `sheetTabs`를 단일 진실 원천으로 유지한다. 화면 미리보기와 다운로드 포맷 변환을 모두 이 `GoogleSheetTabPayload[]`에서 파생해, CSV/XLSX/미리보기 데이터가 서로 어긋나지 않도록 한다. XLSX는 서버 라우트에서 생성해 브라우저 번들 증가를 피하고, 결과 화면은 학생요약/공식평가요약 두 개의 미리보기 테이블을 함께 렌더링한다.

**Tech Stack:** Next.js App Router, React Server Components, route handlers, TypeScript, Vitest, SheetJS `xlsx`

---

## Scope and Assumptions

- 현재 `SummaryExportsCard`는 `학생요약 CSV 다운로드`, `공식평가요약 CSV 다운로드`, `공식평가요약 미리보기`만 제공한다.
- 현재 코드베이스에는 XLSX 라이브러리가 없으므로 dependency 추가가 필요하다.
- 추천 UX는 `CSV 2개 유지 + 합본 XLSX 1개 추가`다.
  - 합본 XLSX 안에는 `학생요약`, `공식평가요약` 두 탭을 함께 넣는다.
  - 버튼 수를 과도하게 늘리지 않으면서 학교 현장에서 내려받기 흐름을 단순화할 수 있다.
- 이번 범위에서는 Google Sheets 양식 자체는 바꾸지 않는다. 다운로드와 화면 미리보기만 확장한다.

## File Map

**Modify**
- `/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx`
- `/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/summary-exports-card.tsx`
- `/Volumes/DATA/Dev/Codex/paps-tracker/package.json`
- `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx`

**Create**
- `/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/google/summary-export-utils.ts`
- `/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/google/summary-export-xlsx.ts`
- `/Volumes/DATA/Dev/Codex/paps-tracker/app/api/results/export.xlsx/route.ts`
- `/Volumes/DATA/Dev/Codex/paps-tracker/tests/google/summary-export-xlsx.test.ts`
- `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/results-export-route.test.ts`

---

### Task 1: Lock the UX with failing tests

**Files:**
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx`

- [ ] **Step 1: 학생요약 미리보기 기대치를 먼저 추가**

```tsx
expect(screen.getByRole("heading", { name: "학생요약 미리보기" })).toBeInTheDocument();
expect(screen.getByText("지난 기록 대비 +2cm")).toBeInTheDocument();
```

- [ ] **Step 2: XLSX 다운로드 기대치도 먼저 추가**

```tsx
expect(screen.getByRole("link", { name: "요약 XLSX 다운로드" })).toBeInTheDocument();
```

- [ ] **Step 3: 테스트 실행해 현재 실패를 확인**

Run: `npm test -- tests/app/teacher-results-page.test.tsx`

Expected: `학생요약 미리보기`, `요약 XLSX 다운로드` 관련 assertion fail

- [ ] **Step 4: Commit**

```bash
git add tests/app/teacher-results-page.test.tsx
git commit -m "test: lock teacher summary preview and xlsx export ux"
```

---

### Task 2: Extract summary-tab helpers so preview and export share one source

**Files:**
- Create: `/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/google/summary-export-utils.ts`
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/summary-exports-card.tsx`

- [ ] **Step 1: Helper test scaffold를 먼저 쓸지 결정**

이번 repo에서는 UI 테스트가 이미 강하므로 별도 helper unit test는 Task 4 route/XLSX 테스트에서 커버한다.

- [ ] **Step 2: 탭 선택/표시 공통 유틸 작성**

```ts
export const getSummaryTab = (
  tabs: GoogleSheetTabPayload[],
  tabName: "학생요약" | "공식평가요약"
) => tabs.find((tab) => tab.tabName === tabName) ?? null;

export const formatDisplayCell = (header: string, value: GoogleSheetCellValue): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (header === "공식등급") return `${value}등급`;
  return String(value);
};
```

- [ ] **Step 3: `SummaryExportsCard` 안의 중복 helper를 유틸로 이동**

목표:
- CSV href builder 유지
- 학생요약/공식평가요약 탭 추출 공통화
- 이후 route handler에서도 같은 tab 선택 함수를 재사용 가능하게 만들기

- [ ] **Step 4: 관련 테스트 재실행**

Run: `npm test -- tests/app/teacher-results-page.test.tsx`

Expected: 아직 학생요약 미리보기/XLSX 버튼 구현 전이라 일부 fail 유지

- [ ] **Step 5: Commit**

```bash
git add src/lib/google/summary-export-utils.ts src/components/teacher/summary-exports-card.tsx
git commit -m "refactor: share summary export helpers"
```

---

### Task 3: Show 학생요약 table alongside 공식평가요약

**Files:**
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/summary-exports-card.tsx`
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx`
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx`

- [ ] **Step 1: 학생요약 미리보기 블록 추가**

추천 UI:
- 상단: 다운로드 버튼 영역
- 하단: `학생요약 미리보기`
- 그 아래: `공식평가요약 미리보기`

```tsx
<h3 className="text-base font-semibold">학생요약 미리보기</h3>
<SummaryPreviewTable tab={studentSummaryTab} />
```

- [ ] **Step 2: 표 렌더러를 재사용 컴포넌트 또는 local helper로 분리**

```tsx
function SummaryPreviewTable({ tab }: { tab: GoogleSheetTabPayload | null }) {
  // empty state + reusable table markup
}
```

- [ ] **Step 3: empty state 문구를 탭별로 구분**

예:
- 학생요약 없음: `아직 대표 기록이 없어 학생요약이 비어 있습니다.`
- 공식평가요약 없음: `아직 공식 대표 기록이 없어 공식평가요약이 비어 있습니다.`

- [ ] **Step 4: UI 테스트 재실행**

Run: `npm test -- tests/app/teacher-results-page.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/teacher/results/page.tsx src/components/teacher/summary-exports-card.tsx tests/app/teacher-results-page.test.tsx
git commit -m "feat: show student summary preview on teacher results"
```

---

### Task 4: Add server-side XLSX export

**Files:**
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/package.json`
- Create: `/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/google/summary-export-xlsx.ts`
- Create: `/Volumes/DATA/Dev/Codex/paps-tracker/app/api/results/export.xlsx/route.ts`
- Create: `/Volumes/DATA/Dev/Codex/paps-tracker/tests/google/summary-export-xlsx.test.ts`
- Create: `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/results-export-route.test.ts`

- [ ] **Step 1: failing workbook test 먼저 작성**

```ts
expect(getSheetNames(buffer)).toEqual(["학생요약", "공식평가요약"]);
expect(readCell(buffer, "학생요약", "B2")).toBe("홍길동");
```

- [ ] **Step 2: route test 먼저 작성**

```ts
expect(response.status).toBe(200);
expect(response.headers.get("content-type")).toContain(
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
);
expect(response.headers.get("content-disposition")).toContain("summary-export.xlsx");
```

- [ ] **Step 3: dependency 추가**

Run: `npm install xlsx`

Expected: `package.json` / lockfile update

- [ ] **Step 4: workbook builder 구현**

```ts
import * as XLSX from "xlsx";

export const buildSummaryWorkbook = (tabs: GoogleSheetTabPayload[]): Buffer => {
  const workbook = XLSX.utils.book_new();
  for (const tab of tabs) {
    const sheet = XLSX.utils.aoa_to_sheet([tab.header, ...tab.rows]);
    XLSX.utils.book_append_sheet(workbook, sheet, tab.tabName);
  }
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
};
```

- [ ] **Step 5: export route 구현**

추천 contract:
- `GET /api/results/export.xlsx`
- 교사 세션 체크
- 현재 teacher page와 동일한 방식으로 `sheetTabs` 생성
- `학생요약`, `공식평가요약`만 뽑아 workbook 생성
- `Response(buffer, { headers })`

- [ ] **Step 6: route + builder 테스트 재실행**

Run:
- `npm test -- tests/google/summary-export-xlsx.test.ts`
- `npm test -- tests/app/results-export-route.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add package.json src/lib/google/summary-export-xlsx.ts app/api/results/export.xlsx/route.ts tests/google/summary-export-xlsx.test.ts tests/app/results-export-route.test.ts
git commit -m "feat: add xlsx summary export"
```

---

### Task 5: Wire XLSX download into the teacher results UI

**Files:**
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/summary-exports-card.tsx`
- Modify: `/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx`

- [ ] **Step 1: 합본 XLSX 버튼 추가**

```tsx
<a
  href="/api/results/export.xlsx"
  className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium"
>
  요약 XLSX 다운로드
</a>
```

- [ ] **Step 2: 필요하면 버튼 라벨 보강**

추천:
- `학생요약 CSV 다운로드`
- `공식평가요약 CSV 다운로드`
- `요약 XLSX 다운로드`

- [ ] **Step 3: UI 테스트 재실행**

Run: `npm test -- tests/app/teacher-results-page.test.tsx`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/teacher/summary-exports-card.tsx tests/app/teacher-results-page.test.tsx
git commit -m "feat: add xlsx summary download action"
```

---

### Task 6: Final verification and ship check

**Files:**
- Modify: none unless failures appear

- [ ] **Step 1: targeted test suite**

Run:
- `npm test -- tests/app/teacher-results-page.test.tsx tests/app/results-export-route.test.ts tests/google/summary-export-xlsx.test.ts`

Expected: PASS

- [ ] **Step 2: full regression**

Run:
- `npm test`
- `npm run lint`
- `npm run build`

Expected: all PASS

- [ ] **Step 3: browser smoke check**

Check:
- `/teacher/results`에서 `학생요약 미리보기`가 보이는지
- `요약 XLSX 다운로드` 링크가 보이는지
- CSV 버튼이 기존처럼 남아 있는지

- [ ] **Step 4: Commit if final fixes were needed**

```bash
git add app src tests package.json
git commit -m "chore: finalize teacher summary preview and xlsx export"
```

---

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

## Why This Plan

- `sheetTabs`를 계속 단일 데이터 원천으로 쓰므로 CSV/XLSX/미리보기 간 불일치가 줄어든다.
- XLSX를 서버에서 만들면 번들 크기 증가와 브라우저 메모리 부담을 피할 수 있다.
- 학생요약 미리보기는 현재 교사 결과 화면의 정보 밀도를 높이면서도, 별도 페이지를 만들지 않아 범위가 작고 검증이 쉽다.
- Google Sheets 양식은 건드리지 않으므로 기존 운영 시트와 충돌하지 않는다.
