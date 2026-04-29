# Teacher Home Session Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the overlapping teacher dashboard and session page into one teacher home experience.

**Architecture:** Keep `/teacher` as the canonical teacher work surface with summary cards and `TeacherSessionWorkspace`. Remove the separate session navigation item from `AppShell`, and make `/teacher/sessions` redirect to `/teacher` for backwards compatibility.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library.

---

## File Structure

- Create: `tests/app/teacher-navigation.test.tsx`
  - Verifies the teacher navigation labels and `/teacher/sessions` redirect behavior.
- Modify: `src/components/layout/app-shell.tsx`
  - Rename `대시보드` to `교사 홈`.
  - Remove the separate `세션` navigation item.
- Modify: `app/teacher/sessions/page.tsx`
  - Replace duplicated session page data loading with a route-level redirect to `/teacher`.

## Task 1: Navigation Contract

**Files:**
- Create: `tests/app/teacher-navigation.test.tsx`

- [x] **Step 1: Write the failing navigation and redirect tests**
  - Render `AppShell` with simple content.
  - Assert the navigation contains `교사 홈`.
  - Assert it does not contain `대시보드`.
  - Assert it does not contain a `세션` link.
  - Import `/teacher/sessions/page` and assert it redirects to `/teacher`.

- [x] **Step 2: Run the focused test to verify RED**
  - Run: `npm test -- --run tests/app/teacher-navigation.test.tsx`
  - Expected: FAIL because the nav still shows `대시보드` and `세션`, and `/teacher/sessions` still renders a duplicated page.

## Task 2: Unified Teacher Home

**Files:**
- Modify: `src/components/layout/app-shell.tsx`
- Modify: `app/teacher/sessions/page.tsx`

- [x] **Step 1: Update teacher navigation**
  - Set the `/teacher` label to `교사 홈`.
  - Remove `{ href: "/teacher/sessions", label: "세션" }`.

- [x] **Step 2: Redirect the old sessions route**
  - Replace `/teacher/sessions/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

export default function TeacherSessionsPage() {
  redirect("/teacher");
}
```

- [x] **Step 3: Run the focused test to verify GREEN**
  - Run: `npm test -- --run tests/app/teacher-navigation.test.tsx`
  - Expected: PASS.

## Task 3: Regression Verification

**Files:**
- No production file changes unless verification reveals a bug.

- [x] **Step 1: Run teacher-focused tests**
  - Run: `npm test -- --run tests/app/teacher-bootstrap.test.tsx tests/app/teacher-session-smoke.test.tsx tests/app/teacher-navigation.test.tsx`
  - Expected: PASS.

- [x] **Step 2: Run the full test suite**
  - Run: `npm test -- --run`
  - Expected: PASS.

- [x] **Step 3: Run lint**
  - Run: `npm run lint`
  - Expected: PASS.

- [x] **Step 4: Run build**
  - Run: `NEXTAUTH_SECRET=test-secret npm run build`
  - Expected: PASS.
