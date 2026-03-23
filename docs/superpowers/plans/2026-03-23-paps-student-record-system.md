# PAPS Student Record System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 승인된 설계에 맞춰 교사용 세션 관리, 학생용 입력 화면, 대표값 선택, 구글 로그인, 구글 시트 저장을 포함한 PAPS 학생 기록 시스템 MVP를 구현한다.

**Architecture:** 빈 저장소에서 시작하므로 Next.js App Router 기반의 단일 풀스택 앱으로 구성한다. 브라우저 UI는 교사/학생 화면을 분리하고, 서버 라우트는 Google OAuth 세션과 Google Sheets 쓰기를 담당한다. PAPS 규칙, 세션 상태, 대표값 로직, 시트 매핑은 도메인 모듈로 분리해 테스트 가능하게 유지한다.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, NextAuth Google Provider, Google Sheets API, Zod, Vitest, React Testing Library

---

## Scope

- 새 Next.js 앱 스캐폴딩
- 교사용 관리 화면
- 학생용 세션 입력 화면
- 1반형/2반 분할형 세션 UI
- 대표값 선택 및 누적 기록 표시
- Google 로그인
- Google Sheets 템플릿/연결/쓰기 로직
- 로컬 검증용 테스트

## Constraints And Invariants

- 학생은 로그인하지 않고 열린 세션에서 이름만 선택한다.
- 학생은 제출 직후에만 자기 기록과 간단 그래프를 본다.
- 공식/연습 구분은 세션 설정으로만 결정된다.
- 연습 세션은 등급을 보여주지 않는다.
- 모든 시도는 저장하되 대표값은 교사가 선택한다.
- 2반 분할형은 같은 종목만 동시에 기록한다.
- 시트 저장 실패 시 앱에는 먼저 저장하고 재동기화 가능해야 한다.
- 학년/종목/성별 규칙은 하드코딩 UI가 아니라 도메인 설정으로 관리한다.

## Acceptance Checks

- 교사가 Google 로그인 후 학교, 학생 명단, 시트 링크, 세션을 관리할 수 있다.
- 학생은 열린 세션에서 이름만 선택하고 기록을 입력할 수 있다.
- 2반 분할형 세션에서 좌우 반이 같은 종목으로 동시에 기록된다.
- 같은 학생의 여러 시도를 저장하고 교사가 대표값을 선택할 수 있다.
- 학생요약/공식평가요약 데이터가 대표값 기준으로 계산된다.
- 구글 시트 링크 검증 실패 시 즉시 오류를 보여준다.
- 시트 쓰기 실패 시 기록은 앱에 남고 재동기화 상태가 표시된다.

## Risks

- Google OAuth 및 Sheets API는 실제 자격 증명이 없으면 실검증이 제한된다.
- 빈 저장소에서 풀스택 앱을 한 번에 올리므로 초기 스캐폴딩 범위가 크다.
- PAPS 등급 기준표는 데이터 파일 구조를 잘못 잡으면 유지보수가 어려워질 수 있다.

## File Structure

**Create**

- `package.json`
- `next.config.ts`
- `tsconfig.json`
- `postcss.config.js`
- `tailwind.config.ts`
- `.eslintrc.json`
- `vitest.config.ts`
- `vitest.setup.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `app/globals.css`
- `app/(teacher)/teacher/page.tsx`
- `app/(teacher)/teacher/students/page.tsx`
- `app/(teacher)/teacher/sessions/page.tsx`
- `app/(teacher)/teacher/results/page.tsx`
- `app/(teacher)/teacher/settings/page.tsx`
- `app/session/[sessionId]/page.tsx`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/sessions/route.ts`
- `app/api/sessions/[sessionId]/route.ts`
- `app/api/sessions/[sessionId]/submit/route.ts`
- `app/api/records/[recordId]/representative/route.ts`
- `app/api/google-sheet/validate/route.ts`
- `app/api/google-sheet/template/route.ts`
- `app/api/google-sheet/resync/route.ts`
- `src/auth.ts`
- `src/lib/env.ts`
- `src/lib/db.ts`
- `src/lib/demo-store.ts`
- `src/lib/store-path.ts`
- `src/lib/paps/types.ts`
- `src/lib/paps/events.ts`
- `src/lib/paps/catalog.ts`
- `src/lib/paps/validation.ts`
- `src/lib/paps/grade.ts`
- `src/lib/paps/summaries.ts`
- `src/lib/google/drive-link.ts`
- `src/lib/google/sheets.ts`
- `src/lib/google/template.ts`
- `src/lib/google/resync.ts`
- `src/lib/teacher-auth.ts`
- `src/components/layout/app-shell.tsx`
- `src/components/teacher/session-form.tsx`
- `src/components/teacher/student-table.tsx`
- `src/components/teacher/result-table.tsx`
- `src/components/teacher/sync-status-card.tsx`
- `src/components/charts/teacher-progress-chart.tsx`
- `src/components/student/name-picker.tsx`
- `src/components/student/record-form.tsx`
- `src/components/student/instant-result-card.tsx`
- `src/components/student/split-session-view.tsx`
- `src/components/charts/progress-mini-chart.tsx`
- `src/components/charts/teacher-progress-chart.tsx`
- `src/data/paps/grades.ts`
- `src/data/paps/events.ts`
- `src/data/paps/demo.ts`
- `tests/paps/grade-rules.test.ts`
- `tests/paps/validation.test.ts`
- `tests/paps/summaries.test.ts`
- `tests/google/drive-link.test.ts`
- `tests/app/student-session.test.tsx`
- `tests/app/teacher-representative.test.tsx`
- `tests/app/teacher-session-smoke.test.tsx`
- `.env.example`
- `README.md`

**Modify**

- `docs/superpowers/specs/2026-03-23-paps-student-record-system-design.md`

## Task 1: Scaffold The App

**Files:**
- Create: `package.json`
- Create: `next.config.ts`
- Create: `tsconfig.json`
- Create: `postcss.config.js`
- Create: `tailwind.config.ts`
- Create: `.eslintrc.json`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Write the failing bootstrap command expectation**

Document in `README.md` the expected bootstrap commands:

```bash
npm install
npm run lint
npm run test
```

Expected initial state before implementation: commands fail because app files do not exist yet.

- [ ] **Step 2: Create minimal Next.js project files**

Add a Next.js App Router app with TypeScript, Tailwind, ESLint config, Vitest config, jsdom, React Testing Library setup, and a base landing page that links to teacher and student routes.

- [ ] **Step 3: Run installation**

Run:

```bash
npm install
```

Expected: dependencies install successfully.

- [ ] **Step 4: Run baseline checks**

Run:

```bash
npm run lint
npm run test
```

Expected: test runner executes with zero or placeholder passing tests and lint completes.

## Task 2: Model PAPS Domain Rules

**Files:**
- Create: `src/lib/paps/types.ts`
- Create: `src/lib/paps/catalog.ts`
- Create: `src/lib/paps/validation.ts`
- Create: `src/lib/paps/grade.ts`
- Create: `src/lib/paps/summaries.ts`
- Create: `src/data/paps/events.ts`
- Create: `src/data/paps/grades.ts`
- Test: `tests/paps/grade-rules.test.ts`
- Test: `tests/paps/validation.test.ts`
- Test: `tests/paps/summaries.test.ts`

- [ ] **Step 1: Write failing validation tests**

Cover:

```ts
it("rejects event selection outside the configured session event")
it("rejects a two-class session with different events")
it("keeps all attempts and marks no representative by default")
it("omits grade output for practice sessions")
it("enforces grade-specific event eligibility")
it("enforces sex-specific official grade lookup")
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/paps/validation.test.ts tests/paps/summaries.test.ts
```

Expected: FAIL with missing module errors.

- [ ] **Step 3: Implement domain modules**

Add TypeScript types and helpers for:

- session type
- class scope
- event catalog with units
- grade/sex/event eligibility matrix
- attempt storage
- representative selection
- official grade calculation
- practice summary generation

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/paps/validation.test.ts tests/paps/summaries.test.ts
```

Expected: PASS.

## Task 3: Build Demo Data And Storage Layer

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/demo-store.ts`
- Create: `src/lib/store-path.ts`
- Create: `src/data/paps/demo.ts`
- Modify: `src/lib/paps/types.ts`
- Test: `tests/paps/summaries.test.ts`

- [ ] **Step 1: Write failing tests for attempt persistence and representative updates**

Cover:

```ts
it("stores multiple attempts for the same student and session")
it("updates summaries when a teacher selects a representative attempt")
it("preserves records when sync status changes to failed")
it("persists school and class records across store reloads")
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/paps/summaries.test.ts
```

Expected: FAIL because persistence helpers are not implemented.

- [ ] **Step 3: Implement file-backed MVP storage**

Use a file-backed JSON store under a dedicated app data path to support:

- schools
- classes
- teachers
- students
- sessions
- attempts
- sync error logs
- representative selection audit logs
- sync status
- representative selection

Do not use in-memory-only storage. Data must survive dev-server restart and page reload. Keep the abstraction narrow so a real DB can replace it later.

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/paps/summaries.test.ts
```

Expected: PASS.

## Task 4: Implement Google Auth And Sheet Utilities

**Files:**
- Create: `src/auth.ts`
- Create: `src/lib/env.ts`
- Create: `src/lib/google/drive-link.ts`
- Create: `src/lib/google/sheets.ts`
- Create: `src/lib/google/template.ts`
- Create: `src/lib/google/resync.ts`
- Create: `src/lib/teacher-auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/api/google-sheet/validate/route.ts`
- Create: `app/api/google-sheet/template/route.ts`
- Create: `app/api/google-sheet/resync/route.ts`
- Test: `tests/google/drive-link.test.ts`

- [ ] **Step 1: Write failing tests for sheet link parsing**

Cover:

```ts
it("extracts a spreadsheet id from a valid Google Sheets URL")
it("rejects non-Google or malformed URLs")
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts
```

Expected: FAIL with missing parser module.

- [ ] **Step 3: Implement auth and Google helpers**

Add:

- NextAuth Google provider setup
- environment validation
- teacher session guard helper for pages and route handlers
- sheet URL parser
- template copy-link generator
- write batch helper for sheet tabs
- resync queue processor

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts
```

Expected: PASS.

## Task 5: Build Teacher Management UI

**Files:**
- Create: `app/(teacher)/teacher/page.tsx`
- Create: `app/(teacher)/teacher/students/page.tsx`
- Create: `app/(teacher)/teacher/sessions/page.tsx`
- Create: `app/(teacher)/teacher/results/page.tsx`
- Create: `app/(teacher)/teacher/settings/page.tsx`
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/teacher/session-form.tsx`
- Create: `src/components/teacher/student-table.tsx`
- Create: `src/components/teacher/result-table.tsx`
- Create: `src/components/teacher/sync-status-card.tsx`
- Create: `src/components/charts/teacher-progress-chart.tsx`
- Create: `app/api/sessions/route.ts`
- Create: `app/api/sessions/[sessionId]/route.ts`
- Create: `app/api/records/[recordId]/representative/route.ts`
- Create: `app/api/schools/route.ts`
- Create: `app/api/classes/route.ts`
- Create: `app/api/students/route.ts`
- Test: `tests/app/teacher-representative.test.tsx`
- Test: `tests/app/teacher-session-smoke.test.tsx`

- [ ] **Step 1: Write failing UI tests for teacher flows**

Cover:

```tsx
it("creates a one-class or two-class session from the teacher dashboard")
it("blocks a two-class session when the selected classes do not share the same event")
it("lets a teacher choose the representative attempt")
it("shows sync failure status with a resync action")
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/app/teacher-representative.test.tsx tests/app/teacher-session-smoke.test.tsx
```

Expected: FAIL because pages and components are missing.

- [ ] **Step 3: Implement teacher pages and APIs**

Build:

- teacher dashboard summary
- school and class management sections backed by stored entities
- student roster management
- school/class/student CRUD route handlers for persisted edits
- session creation form
- 1반형/2반 분할형 selection
- teacher-only route protection on `/teacher` pages and write APIs
- session open/close controls on the teacher dashboard
- results page with attempt list and representative picker
- teacher progress chart wired into results page
- sync status card with requeue action

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/app/teacher-representative.test.tsx tests/app/teacher-session-smoke.test.tsx
```

Expected: PASS.

## Task 6: Build Student Session UI

**Files:**
- Create: `app/session/[sessionId]/page.tsx`
- Create: `src/components/student/name-picker.tsx`
- Create: `src/components/student/record-form.tsx`
- Create: `src/components/student/instant-result-card.tsx`
- Create: `src/components/student/split-session-view.tsx`
- Create: `src/components/charts/progress-mini-chart.tsx`
- Create: `app/api/sessions/[sessionId]/submit/route.ts`
- Test: `tests/app/student-session.test.tsx`

- [ ] **Step 1: Write failing UI tests for student flows**

Cover:

```tsx
it("shows only a name picker before input")
it("submits a new attempt for a one-class session")
it("renders a split two-class layout when the session is configured that way")
it("shows an instant personal result after submit and hides it on next student reset")
it("blocks student submission when the session is closed")
```

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/app/student-session.test.tsx
```

Expected: FAIL because student routes and components are missing.

- [ ] **Step 3: Implement student experience**

Build:

- name-only student entry
- event-specific numeric input
- submit flow
- instant result card with simple trend
- next-student reset flow
- split session layout for two classes
- session open-state enforcement on page load and submit API

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/app/student-session.test.tsx
```

Expected: PASS.

## Task 7: Wire Sheet Mapping And Template Output

**Files:**
- Modify: `src/lib/google/sheets.ts`
- Modify: `src/lib/google/template.ts`
- Modify: `src/lib/paps/summaries.ts`
- Modify: `src/data/paps/demo.ts`
- Modify: `app/(teacher)/teacher/settings/page.tsx`
- Modify: `app/(teacher)/teacher/results/page.tsx`
- Modify: `app/api/google-sheet/validate/route.ts`
- Modify: `app/api/google-sheet/resync/route.ts`

- [ ] **Step 1: Write failing tests or fixtures for tab mapping**

Add coverage or assertions for:

- `설정`
- `학생명단`
- `세션기록`
- `학생요약`
- `공식평가요약`
- `오류로그`
- `수정로그`

- [ ] **Step 2: Run targeted tests to confirm failure**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts tests/paps/summaries.test.ts
```

Expected: FAIL for missing mapping behavior.

- [ ] **Step 3: Implement sheet serialization**

Serialize app data into the prototype tab shapes already defined in:

- `output/spreadsheet/paps-google-sheet-prototype.xlsx`
- `scripts/create_paps_sheet_prototype.py`

The app should generate payloads that match those column headers.

- [ ] **Step 4: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts tests/paps/summaries.test.ts
```

Expected: PASS.

## Task 8: Final Smoke Verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Start the dev server**

Run:

```bash
npm run dev
```

Expected: local app starts successfully.

- [ ] **Step 2: Smoke test teacher and student routes**

Check:

- `/teacher`
- `/teacher/sessions`
- `/teacher/results`
- `/session/<demo-session-id>`

Expected: pages render and demo flows work without crashing.

- [ ] **Step 3: Run the full verification suite**

Run:

```bash
npm run lint
npm run test
```

Expected: PASS.

- [ ] **Step 4: Record limitations**

Document in `README.md`:

- Google credentials required for live auth/sheet sync
- demo mode behavior
- known MVP limitations

## Verification Plan

- Unit tests for validation, summaries, and Google link parsing
- Component tests for teacher and student flows
- Manual smoke check for local routes
- Manual configuration check for `.env.example`

## Plan-vs-Implementation Record

When executing, maintain short notes on:

- user-approved assumptions
- Google API limitations encountered
- any plan drift caused by framework constraints
- verification results and follow-up items
