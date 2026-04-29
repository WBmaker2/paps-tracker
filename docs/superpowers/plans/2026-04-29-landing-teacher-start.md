# Landing Teacher Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the landing page a teacher-first start screen and remove the misleading public student-entry button.

**Architecture:** Keep the landing page static in `app/page.tsx`. Render one primary teacher link to `/teacher` and a non-clickable student guidance card explaining that students enter through teacher-shared session links or QR codes.

**Tech Stack:** Next.js App Router, React, Vitest, Testing Library.

---

## File Structure

- Modify: `tests/app/home-page.test.tsx`
  - Add assertions that the landing page has one teacher CTA and no public student session link.
- Modify: `app/page.tsx`
  - Remove the `entryPoints` two-link model.
  - Add a teacher CTA card and student guidance card.

## Task 1: Landing Behavior Contract

**Files:**
- Modify: `tests/app/home-page.test.tsx`

- [x] **Step 1: Write the failing test**
  - Assert the page has a `교사 홈으로 시작` link to `/teacher`.
  - Assert there is no `학생 입력 영역` link.
  - Assert no link points to `/session/demo`.
  - Assert the page explains that students use a teacher-shared session link or QR code.

- [x] **Step 2: Run focused test to verify RED**
  - Run: `npm test -- --run tests/app/home-page.test.tsx`
  - Expected: FAIL because the current page still has a public `학생 입력 영역` link to `/session/demo`.

## Task 2: Teacher-First Landing Layout

**Files:**
- Modify: `app/page.tsx`

- [x] **Step 1: Replace the entry-points array**
  - Remove the second student link entry.
  - Render the teacher area as the only `Link` component.
  - Render student information as a plain `article`.

- [x] **Step 2: Update copy**
  - Hero copy should say that teachers open sessions first.
  - Student guidance should say students enter through teacher-shared session links or QR codes.

- [x] **Step 3: Run focused test to verify GREEN**
  - Run: `npm test -- --run tests/app/home-page.test.tsx`
  - Expected: PASS.

## Task 3: Verification

**Files:**
- No production files unless verification reveals a bug.

- [x] **Step 1: Run full tests**
  - Run: `npm test -- --run`
  - Expected: PASS.

- [x] **Step 2: Run lint**
  - Run: `npm run lint`
  - Expected: PASS.

- [x] **Step 3: Run build**
  - Run: `NEXTAUTH_SECRET=test-secret npm run build`
  - Expected: PASS.
