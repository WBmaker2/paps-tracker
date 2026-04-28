# Teacher Student Growth Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a teacher-facing student growth report to the existing results screen so teachers can search one student and review that student's event-by-event PAPS history as tables and graphs.

**Architecture:** Keep the feature inside `/teacher/results` instead of creating a new tab. Build a pure view-model layer that groups existing `TeacherResultRowView` rows by student and event, then render a focused report component from that model. Reuse the current results filter/search state so the teacher can move from "student name search" to "student growth report" without changing pages.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Vitest, Testing Library, Tailwind CSS.

---

## File Structure

- Modify: `src/lib/teacher-results.ts`
  - Add student growth report types.
  - Add `buildStudentGrowthReports(rows)` to group results by `studentId` and `eventId`.
  - Add `findStudentGrowthReport(reports, queryOrStudentId)` helpers only if needed by UI.
- Create: `src/components/teacher/student-growth-report.tsx`
  - Render selected student summary and event cards.
  - Show empty guidance when no student is selected.
- Create: `src/components/teacher/student-growth-event-card.tsx`
  - Render one event's chart and table.
  - Keep this focused so the main workspace does not grow too much.
- Modify: `src/components/charts/teacher-progress-chart.tsx`
  - Accept optional custom labels and support chronological event history, while keeping existing sidebar usage working.
- Modify: `src/components/teacher/teacher-results-workspace.tsx`
  - Build growth reports from `rows`.
  - Select a student automatically when search narrows to one student; otherwise show candidate buttons.
  - Pass selected report to the new component.
- Test: `tests/lib/teacher-results-view-model.test.ts`
  - Verify rows are grouped by student, then by event, sorted chronologically.
- Test: `tests/app/teacher-results-workspace.test.tsx`
  - Verify searching a student reveals the growth report with event table/graph labels.

## Task 1: View Model

**Files:**
- Modify: `tests/lib/teacher-results-view-model.test.ts`
- Modify: `src/lib/teacher-results.ts`

- [ ] **Step 1: Write failing view-model test**
  - Add rows across two sessions and two events for the same student.
  - Expect one student report with event groups.
  - Expect attempts sorted by `createdAt` and enriched with `sessionName`, `sessionType`, `eventLabel`, `unit`, and representative status.

- [ ] **Step 2: Run the focused test**
  - Run: `npm test -- --run tests/lib/teacher-results-view-model.test.ts`
  - Expected: FAIL because `buildStudentGrowthReports` does not exist.

- [ ] **Step 3: Implement minimal grouping**
  - Add exported types:
    - `TeacherStudentGrowthAttemptView`
    - `TeacherStudentGrowthEventView`
    - `TeacherStudentGrowthReportView`
  - Add `buildStudentGrowthReports(rows)`.

- [ ] **Step 4: Re-run focused test**
  - Run: `npm test -- --run tests/lib/teacher-results-view-model.test.ts`
  - Expected: PASS.

## Task 2: Growth Report Components

**Files:**
- Create: `src/components/teacher/student-growth-report.tsx`
- Create: `src/components/teacher/student-growth-event-card.tsx`
- Modify: `src/components/charts/teacher-progress-chart.tsx`
- Modify: `tests/app/teacher-results-workspace.test.tsx`

- [ ] **Step 1: Write failing UI test**
  - Search a student name.
  - Expect `학생별 성장 리포트`, selected student name, event names, table records, and chart title to appear.

- [ ] **Step 2: Run focused UI test**
  - Run: `npm test -- --run tests/app/teacher-results-workspace.test.tsx`
  - Expected: FAIL because report UI is not connected.

- [ ] **Step 3: Implement report UI**
  - `StudentGrowthReport` renders candidate buttons when multiple students match.
  - `StudentGrowthEventCard` renders chart and table for one event.
  - `TeacherProgressChart` keeps existing props but accepts optional `getLabel` and `description`.

- [ ] **Step 4: Re-run focused UI test**
  - Run: `npm test -- --run tests/app/teacher-results-workspace.test.tsx`
  - Expected: PASS.

## Task 3: Workspace Integration

**Files:**
- Modify: `src/components/teacher/teacher-results-workspace.tsx`
- Modify: `src/components/teacher/teacher-results-workspace-filters.ts` only if needed.

- [ ] **Step 1: Connect report state**
  - Build reports from current `rows`.
  - Compute matching students from `filterState.query`.
  - Auto-select when exactly one student matches.
  - Reset selected student on filter reset.

- [ ] **Step 2: Preserve existing behavior**
  - Existing result table filtering, focused row, sidebar sync metadata, representative update behavior must remain unchanged.

- [ ] **Step 3: Run focused tests**
  - Run: `npm test -- --run tests/app/teacher-results-workspace.test.tsx tests/lib/teacher-results-view-model.test.ts`
  - Expected: PASS.

## Task 4: Verification

**Files:**
- No production files unless test failures reveal a bug.

- [ ] **Step 1: Run student/results related tests**
  - Run: `npm test -- --run tests/app/teacher-results-workspace.test.tsx tests/app/teacher-results-page.test.tsx tests/lib/teacher-results-view-model.test.ts`
  - Expected: PASS.

- [ ] **Step 2: Run all tests**
  - Run: `npm test -- --run`
  - Expected: PASS.

- [ ] **Step 3: Run lint**
  - Run: `npm run lint`
  - Expected: PASS.

- [ ] **Step 4: Run production build**
  - Run: `NEXTAUTH_SECRET=test-secret npm run build`
  - Expected: PASS.

## Non-Goals

- Do not create a new `/teacher/student-history` route in this step.
- Do not change Google Sheets schema.
- Do not add PDF export yet.
- Do not change representative selection rules.
