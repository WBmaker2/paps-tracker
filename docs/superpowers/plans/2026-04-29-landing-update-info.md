# Landing Update Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 랜딩 페이지에 현재 버전 `v1.0.0`과 `Update info` 팝업을 추가하고, MVP부터 현재까지의 변경 이력을 문서로 남깁니다.

**Architecture:** 업데이트 기록은 `src/lib/update-history.ts`의 작은 정적 데이터로 관리합니다. 랜딩 페이지는 서버 컴포넌트 상태를 유지하고, 팝업 열기/닫기만 `src/components/home/update-info-dialog.tsx` 클라이언트 컴포넌트가 담당합니다.

**Tech Stack:** Next.js App Router, React 19, Vitest, Testing Library, Markdown docs

---

### Task 1: Failing Tests

**Files:**
- Modify: `tests/app/home-page.test.tsx`
- Modify: `tests/lib/runtime-docs.test.ts`

- [x] **Step 1: Add landing behavior test**

```tsx
expect(screen.getByText("v1.0.0")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: /Update info/i }));
expect(screen.getByRole("dialog", { name: /업데이트 기록/ })).toBeInTheDocument();
```

- [x] **Step 2: Add docs existence test**

```ts
const updateHistory = readFileSync(join(projectRoot, "docs", "update-history.md"), "utf8");
expect(updateHistory).toContain("v1.0.0");
expect(updateHistory).toContain("v0.1.0");
```

- [x] **Step 3: Run tests to verify RED**

Run: `npm test -- --run tests/app/home-page.test.tsx`

Expected: FAIL because `v1.0.0` is not rendered yet.

Run: `npm test -- --run tests/lib/runtime-docs.test.ts`

Expected: FAIL because `docs/update-history.md` does not exist yet.

### Task 2: Update History Data And Docs

**Files:**
- Create: `src/lib/update-history.ts`
- Create: `docs/update-history.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Create release data**

Create `APP_VERSION = "v1.0.0"` and a latest-first `UPDATE_HISTORY` array with versions `v1.0.0` through `v0.1.0`.

- [x] **Step 2: Create user-facing update history document**

Write `docs/update-history.md` with the same version milestones and concise Korean summaries.

- [x] **Step 3: Align package metadata**

Change package metadata version from `0.1.0` to `1.0.0` in `package.json` and `package-lock.json`.

### Task 3: Landing Modal UI

**Files:**
- Create: `src/components/home/update-info-dialog.tsx`
- Modify: `app/page.tsx`

- [x] **Step 1: Add client dialog component**

Implement a small `Update info` button and modal with `role="dialog"`, `aria-modal="true"`, and a close button labelled `닫기`.

- [x] **Step 2: Wire landing page**

Import `APP_VERSION`, `UPDATE_HISTORY`, and `UpdateInfoDialog`; render the version badge next to `PAPS Tracker` and the dialog trigger near the hero copy.

### Task 4: Verification

**Files:**
- Test: `tests/app/home-page.test.tsx`
- Test: `tests/lib/runtime-docs.test.ts`

- [x] **Step 1: Run focused tests**

Run: `npm test -- --run tests/app/home-page.test.tsx tests/lib/runtime-docs.test.ts`

Expected: PASS.

- [x] **Step 2: Run full test suite**

Run: `npm test -- --run`

Expected: PASS.

- [x] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS.

- [x] **Step 4: Run production build**

Run: `NEXTAUTH_SECRET=test-secret npm run build`

Expected: PASS.
