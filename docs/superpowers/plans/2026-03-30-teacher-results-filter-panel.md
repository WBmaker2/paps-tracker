# Teacher Results Filter Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 교사 결과 화면에 검색/필터 패널을 추가하고, 여러 세션 결과를 집계한 상태에서 대표값 선택과 요약 기능이 유지되도록 만든다.

**Architecture:** `/teacher/results` 서버 페이지가 여러 세션을 합쳐 `TeacherResultsViewModel`을 만들고, 새 클라이언트 워크스페이스 컴포넌트가 필터 상태와 포커스 학생 상태를 관리한다. 기존 대표값 선택 및 요약 재계산 route는 유지하고, `ResultTable`은 상위 상태와 동기화되는 형태로 정리한다.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Testing Library

---

### Task 1: 결과 View Model Helper

**Files:**
- Modify: `src/lib/teacher-results.ts`
- Modify: `src/components/teacher/result-table.tsx`
- Test: `tests/lib/teacher-results-view-model.test.ts`

- [ ] **Step 1: Failing test 작성**
- [ ] **Step 2: 새 테스트만 실행해 실패 확인**
- [ ] **Step 3: `TeacherResultRowView`, `TeacherResultFilterOptions`, `TeacherResultsViewModel` 타입과 helper 구현**
- [ ] **Step 4: helper 테스트 재실행**

### Task 2: 서버 페이지 집계 로직 정리

**Files:**
- Modify: `app/teacher/results/page.tsx`
- Modify: `src/lib/teacher-results.ts`
- Test: `tests/app/teacher-results-page.test.tsx`
- Test: `tests/app/teacher-results-selection.test.ts`

- [ ] **Step 1: 페이지 테스트를 확장해 새 UI 계약이 없어서 실패하게 만들기**
- [ ] **Step 2: 여러 세션 결과를 집계한 `TeacherResultsViewModel`을 페이지에서 사용하도록 변경**
- [ ] **Step 3: 페이지/세션 선택 테스트 재실행**

### Task 3: 클라이언트 필터 워크스페이스

**Files:**
- Create: `src/components/teacher/teacher-results-workspace.tsx`
- Create: `src/components/teacher/results-filter-panel.tsx`
- Test: `tests/app/teacher-results-workspace.test.tsx`

- [ ] **Step 1: 워크스페이스 테스트를 먼저 작성하고 실패 확인**
- [ ] **Step 2: 필터 state, 포커스 row 계산, 빈 상태 처리를 최소 구현**
- [ ] **Step 3: 워크스페이스 테스트 재실행**

### Task 4: ResultTable / 우측 패널 연동

**Files:**
- Modify: `src/components/teacher/result-table.tsx`
- Modify: `src/components/teacher/sync-status-card.tsx`
- Modify: `src/components/teacher/summary-exports-card.tsx`
- Test: `tests/app/teacher-representative.test.tsx`
- Test: `tests/app/teacher-rebuild.test.tsx`

- [ ] **Step 1: 회귀 테스트 보강**
- [ ] **Step 2: `ResultTable`을 상위 rows 상태와 동기화되도록 조정**
- [ ] **Step 3: 요약 카드 안내 문구와 우측 패널 empty handling 추가**
- [ ] **Step 4: 회귀 테스트 재실행**

### Task 5: 전체 검증

**Files:**
- Modify: `docs/superpowers/plans/2026-03-30-teacher-results-filter-panel.md`

- [ ] **Step 1: 기능 관련 테스트 실행**
- [ ] **Step 2: 전체 테스트 실행**
- [ ] **Step 3: 린트 실행**
- [ ] **Step 4: 빌드 실행**
- [ ] **Step 5: 결과를 계획 문서와 QA 보고서 초안에 반영**
