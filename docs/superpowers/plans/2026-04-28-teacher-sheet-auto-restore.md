# Teacher Sheet Auto Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a teacher who already saved school information return through Google sign-in and automatically reload the previously connected Google Sheet without manually saving school information again.

**Architecture:** Keep Google sign-in as the teacher identity gate, and keep Google Sheets as the source of school/class/student data. Make the server-side spreadsheet binding durable with a long-lived httpOnly cookie. Add a small client-side auto-restore bridge that uses the saved local browser school settings only when the server reports that no sheet is connected.

**Tech Stack:** Next.js App Router, NextAuth, React client components, Google Sheets-backed store, Vitest, Testing Library.

---

## File Structure

- Modify: `src/lib/google/sheets-store.ts`
  - Export long-lived spreadsheet cookie constants and helper options.
- Modify: `app/api/google-sheet/connect/route.ts`
  - Use the shared long-lived cookie options when a sheet connects successfully.
- Create: `src/components/teacher/saved-school-settings.ts`
  - Own browser localStorage read/write and value creation for saved school settings.
- Modify: `src/components/teacher/settings-management.tsx`
  - Reuse the shared saved-school helpers instead of private local functions.
- Create: `src/components/teacher/teacher-sheet-auto-loader.tsx`
  - If teacher pages load with `not_connected`, reconnect the last saved sheet URL and refresh.
- Modify: teacher pages under `app/teacher/**/page.tsx`
  - Render `TeacherSheetAutoLoader` on teacher dashboard, settings, students, sessions, and results.
- Test: `tests/app/teacher-settings-management.test.tsx`
  - Verify the connect route sets a durable spreadsheet cookie.
- Test: `tests/app/teacher-sheet-auto-loader.test.tsx`
  - Verify the auto-loader reconnects using saved local settings and refreshes the page.

## Task 1: Durable Spreadsheet Cookie

**Files:**
- Modify: `tests/app/teacher-settings-management.test.tsx`
- Modify: `src/lib/google/sheets-store.ts`
- Modify: `app/api/google-sheet/connect/route.ts`

- [x] **Step 1: Write a failing route test**
  - Call `/api/google-sheet/connect` with a valid sheet URL.
  - Assert the `set-cookie` header contains `paps-spreadsheet-id`, `HttpOnly`, `SameSite=Lax`, `Path=/`, and a one-year `Max-Age`.

- [x] **Step 2: Run the focused test**
  - Run: `npm test -- --run tests/app/teacher-settings-management.test.tsx`
  - Expected: FAIL because the current cookie has no `Max-Age`.

- [x] **Step 3: Implement shared cookie options**
  - Export `PAPS_SPREADSHEET_ID_COOKIE_MAX_AGE_SECONDS` and `createPapsSpreadsheetIdCookieOptions()`.
  - Use the helper in the connect route.

- [x] **Step 4: Re-run the focused test**
  - Run: `npm test -- --run tests/app/teacher-settings-management.test.tsx`
  - Expected: PASS.

## Task 2: Shared Saved School Settings Helpers

**Files:**
- Create: `src/components/teacher/saved-school-settings.ts`
- Modify: `src/components/teacher/settings-management.tsx`

- [x] **Step 1: Extract helper code**
  - Move the storage key, saved settings type, read/write helpers, equality helper, and creation helper out of `settings-management.tsx`.

- [x] **Step 2: Keep settings UI behavior unchanged**
  - Import the helpers back into `settings-management.tsx`.
  - Do not change visible settings copy in this task.

- [x] **Step 3: Run the settings UI test**
  - Run: `npm test -- --run tests/app/teacher-settings-management.test.tsx`
  - Expected: PASS.

## Task 3: Teacher Sheet Auto Loader

**Files:**
- Create: `tests/app/teacher-sheet-auto-loader.test.tsx`
- Create: `src/components/teacher/teacher-sheet-auto-loader.tsx`

- [x] **Step 1: Write a failing component test**
  - Seed localStorage with saved school settings.
  - Render `TeacherSheetAutoLoader` with `sheetStatus.code = "not_connected"`.
  - Assert it posts to `/api/google-sheet/connect` with the saved sheet URL and school name.
  - Assert it refreshes the router on success.

- [x] **Step 2: Run the focused test**
  - Run: `npm test -- --run tests/app/teacher-sheet-auto-loader.test.tsx`
  - Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement the auto-loader**
  - Return `null` when the sheet is already connected or reconnect is not allowed.
  - Read saved school settings from localStorage.
  - POST the saved `sheetUrl` and `schoolName` to `/api/google-sheet/connect`.
  - On success, persist the returned school state and call `router.refresh()`.
  - Render a small status card while restoring or when restore fails.

- [x] **Step 4: Re-run the focused test**
  - Run: `npm test -- --run tests/app/teacher-sheet-auto-loader.test.tsx`
  - Expected: PASS.

## Task 4: Teacher Page Integration

**Files:**
- Modify: `app/teacher/page.tsx`
- Modify: `app/teacher/settings/page.tsx`
- Modify: `app/teacher/students/page.tsx`
- Modify: `app/teacher/sessions/page.tsx`
- Modify: `app/teacher/results/page.tsx`
- Modify: `tests/app/teacher-bootstrap.test.tsx`

- [x] **Step 1: Render the loader on teacher pages**
  - Add `TeacherSheetAutoLoader sheetStatus={sheetStatus}` next to `TeacherDataRefresh`.

- [x] **Step 2: Verify dashboard behavior**
  - Update the bootstrap/page tests only if the new status text appears in the disconnected state.

- [x] **Step 3: Run focused page tests**
  - Run: `npm test -- --run tests/app/teacher-bootstrap.test.tsx tests/app/teacher-results-page.test.tsx`
  - Expected: PASS.

## Task 5: Verification

**Files:**
- No production files unless verification reveals a bug.

- [x] **Step 1: Run focused tests**
  - Run: `npm test -- --run tests/app/teacher-settings-management.test.tsx tests/app/teacher-sheet-auto-loader.test.tsx tests/app/teacher-bootstrap.test.tsx tests/app/teacher-results-page.test.tsx`
  - Expected: PASS.

- [x] **Step 2: Run all tests**
  - Run: `npm test -- --run`
  - Expected: PASS.

- [x] **Step 3: Run lint**
  - Run: `npm run lint`
  - Expected: PASS.

- [x] **Step 4: Run build**
  - Run: `NEXTAUTH_SECRET=test-secret npm run build`
  - Expected: PASS.

## Non-Goals

- Do not add a database-backed teacher-to-spreadsheet registry in this step.
- Do not change Google OAuth provider settings.
- Do not remove the existing manual school information save flow.
- Do not auto-claim an existing sheet when the current teacher is not authorized; keep that explicit.
