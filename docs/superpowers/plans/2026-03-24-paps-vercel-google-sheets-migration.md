# PAPS Vercel + Google Sheets Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 파일 기반 `demo-store` 운영 경로를 제거하고 Google Sheets를 단일 실제 저장소로 전환한 뒤 무료 `Vercel Hobby`에 배포 가능한 상태로 만든다.

**Architecture:** 기존 PAPS 도메인 규칙과 UI는 최대한 유지하고, 저장 경계만 `PAPS store interface -> Google Sheets-backed store`로 치환한다. 학생 제출은 append-only 원본 기록을 시트에 직접 저장하고, 교사 대표값 반영은 `대표값`, `학생요약`, `공식평가요약` 탭을 재계산 가능한 구조로 유지한다.

**Tech Stack:** Next.js App Router, React, TypeScript, NextAuth Google Provider, Google Sheets API, Vitest, React Testing Library, Vercel Hobby

---

## Scope

- 운영 저장소를 Google Sheets 단일 저장소로 전환
- 서비스 계정 기반 시트 접근 검증 구현
- 학생 제출 성공 조건을 `시트 쓰기 성공`으로 변경
- 대표값/요약/재계산 경로 구현
- 교사 bootstrap, 학생/세션 CRUD를 시트 기반으로 전환
- `demo-store`, `PAPS_STORE_PATH`, 파일 IO 의존을 운영 경로에서 제거
- Vercel 무료 배포 설정과 문서 갱신

## Constraints And Invariants

- 학생은 로그인 없이 열린 세션에서 이름만 선택한다.
- 학생 제출은 Google Sheets append가 성공해야만 완료다.
- 연습 세션은 등급을 보여주지 않는다.
- 원본 기록은 append-only다.
- 대표값은 교사만 선택한다.
- 중복 제출은 `clientSubmissionKey` 기준으로 감지하고 읽기/요약 시 제거한다.
- 요약 범위는 `학교 + 학년도`다.
- 무료 배포를 위해 로컬 파일 영구 저장을 사용하지 않는다.

## Acceptance Checks

- 교사가 시트 링크를 연결할 때 서비스 계정 공유 여부까지 검증된다.
- 교사 bootstrap 응답이 실제 시트 데이터를 읽어 화면을 구성한다.
- 학생 제출 API는 시트 append 성공 시에만 성공 응답을 반환한다.
- 동일 `clientSubmissionKey` 중복 행은 대표값/그래프/요약 계산에서 하나만 반영된다.
- 대표값 선택 후 `대표값`, `학생요약`, `공식평가요약` 탭이 재계산 가능하다.
- 비활성 학생은 학생 목록과 제출 API에서 모두 차단된다.
- 로컬에서 `npm run lint`, `npm test`, `npm run build`가 통과한다.
- Vercel preview deploy가 성공한다.

## Risks

- Google Sheets는 원자적 uniqueness를 제공하지 않아 중복 감지 전략이 중요하다.
- 서비스 계정 공유가 빠지면 교사 연결 흐름이 막힐 수 있다.
- 기존 `demo-store` 기반 테스트/화면이 많아서 저장 경계 추상화가 먼저 필요하다.
- Sheets API 실연동은 자격증명 준비가 필요하므로 테스트 doubles 설계가 중요하다.

## File Structure

**Create**

- `src/lib/store/paps-store.ts`
- `src/lib/store/paps-store-types.ts`
- `src/lib/google/sheets-client.ts`
- `src/lib/google/sheets-schema.ts`
- `src/lib/google/sheets-store.ts`
- `src/lib/google/sheets-bootstrap.ts`
- `src/lib/google/sheets-submit.ts`
- `src/lib/google/sheets-rebuild.ts`
- `scripts/migrate-demo-store-to-sheets.ts`
- `app/api/google-sheet/connect/route.ts`
- `app/api/results/rebuild/route.ts`
- `tests/google/sheets-store.test.ts`
- `tests/google/sheets-submit.test.ts`
- `tests/google/sheets-bootstrap.test.ts`
- `tests/google/sheets-rebuild.test.ts`
- `tests/app/teacher-bootstrap.test.tsx`
- `tests/app/student-submit-sheets.test.tsx`
- `tests/app/teacher-rebuild.test.tsx`
- `vercel.json`

**Modify**

- `src/lib/env.ts`
- `src/lib/google/drive-link.ts`
- `src/lib/google/template.ts`
- `src/lib/google/sheets.ts`
- `src/lib/google/resync.ts`
- `src/lib/teacher-auth.ts`
- `src/lib/paps/types.ts`
- `src/lib/paps/summaries.ts`
- `app/api/google-sheet/validate/route.ts`
- `app/api/google-sheet/connect/route.ts`
- `app/api/google-sheet/template/route.ts`
- `app/api/google-sheet/resync/route.ts`
- `app/api/schools/route.ts`
- `app/api/classes/route.ts`
- `app/api/students/route.ts`
- `app/api/sessions/route.ts`
- `app/api/sessions/[sessionId]/route.ts`
- `app/api/sessions/[sessionId]/submit/route.ts`
- `app/api/records/[recordId]/representative/route.ts`
- `app/api/results/rebuild/route.ts`
- `app/teacher/page.tsx`
- `app/teacher/settings/page.tsx`
- `app/teacher/students/page.tsx`
- `app/teacher/sessions/page.tsx`
- `app/teacher/results/page.tsx`
- `app/session/[sessionId]/page.tsx`
- `src/components/teacher/settings-management.tsx`
- `src/components/teacher/student-table.tsx`
- `src/components/teacher/session-form.tsx`
- `src/components/teacher/result-table.tsx`
- `src/components/teacher/sync-status-card.tsx`
- `src/components/student/name-picker.tsx`
- `src/components/student/record-form.tsx`
- `src/components/student/instant-result-card.tsx`
- `README.md`
- `.env.example`
- `package.json`

**Delete (only after replacement is green)**

- `src/lib/db.ts`
- `src/lib/demo-store.ts`
- `src/lib/store-path.ts`
- `src/data/paps/demo.ts`

## Task 1: Introduce A Store Boundary

**Files:**
- Create: `src/lib/store/paps-store-types.ts`
- Create: `src/lib/store/paps-store.ts`
- Modify: `app/api/schools/route.ts`
- Modify: `app/api/classes/route.ts`
- Modify: `app/api/students/route.ts`
- Modify: `app/api/sessions/route.ts`
- Modify: `app/api/sessions/[sessionId]/route.ts`
- Modify: `app/api/sessions/[sessionId]/submit/route.ts`
- Modify: `app/api/records/[recordId]/representative/route.ts`
- Modify: `app/teacher/page.tsx`
- Modify: `app/teacher/settings/page.tsx`
- Modify: `app/teacher/students/page.tsx`
- Modify: `app/teacher/sessions/page.tsx`
- Modify: `app/teacher/results/page.tsx`
- Modify: `app/session/[sessionId]/page.tsx`
- Test: `tests/app/teacher-bootstrap.test.tsx`

- [ ] **Step 1: Write the failing bootstrap contract test**

Cover:

```ts
it("routes teacher bootstrap loading through createStoreForRequest", async () => {
  const createStoreForRequest = vi.fn(async () => ({ getTeacherBootstrap: vi.fn() }));
  // inject store factory and render teacher page / route
  expect(createStoreForRequest).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run:

```bash
npm run test -- tests/app/teacher-bootstrap.test.tsx
```

Expected: FAIL with missing store boundary module.

- [ ] **Step 3: Create the store interface**

Define a narrow store surface for:

- school read/update
- class CRUD
- student CRUD
- session CRUD
- session record listing
- append attempt
- select representative attempt
- rebuild summaries

Example interface shape:

```ts
export interface PapsStore {
  getTeacherBootstrap(input: { teacherEmail: string }): Promise<TeacherBootstrap>;
  appendSubmission(input: AppendSubmissionInput): Promise<AppendSubmissionResult>;
  selectRepresentative(input: SelectRepresentativeInput): Promise<void>;
}
```

- [ ] **Step 4: Replace direct `getDemoStore()` imports in routes/pages with a factory call**

Use:

```ts
const store = await createStoreForRequest();
```

Leave implementation temporarily delegating to the existing demo store so the boundary lands first.

- [ ] **Step 5: Re-run the targeted test**

Run:

```bash
npm run test -- tests/app/teacher-bootstrap.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/store app tests/app/teacher-bootstrap.test.tsx
git commit -m "refactor: add PAPS store boundary"
```

## Task 2: Implement Google Sheets Client And Schema

**Files:**
- Create: `src/lib/google/sheets-client.ts`
- Create: `src/lib/google/sheets-schema.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/lib/google/drive-link.ts`
- Modify: `src/lib/google/template.ts`
- Test: `tests/google/sheets-store.test.ts`
- Test: `tests/google/drive-link.test.ts`

- [ ] **Step 1: Write failing tests for sheet schema and access validation**

Cover:

```ts
it("parses a spreadsheet id from a docs.google.com sheet URL")
it("rejects a sheet when required tabs or headers are missing")
it("normalizes a service account private key from env")
it("returns an access error when the service account cannot read the sheet")
```

- [ ] **Step 2: Run the targeted tests to verify failure**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts tests/google/sheets-store.test.ts
```

Expected: FAIL with missing client/schema module errors.

- [ ] **Step 3: Implement a low-level Google Sheets client**

Provide methods for:

- `getSpreadsheet(spreadsheetId)`
- `readRange(spreadsheetId, range)`
- `appendRows(spreadsheetId, range, values)`
- `updateRange(spreadsheetId, range, values)`

Use service account credentials only.

- [ ] **Step 4: Implement the sheet schema contract**

Validate:

- required tab names
- required header rows
- template version
- service-account readability

- [ ] **Step 5: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/drive-link.test.ts tests/google/sheets-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/google src/lib/env.ts tests/google
git commit -m "feat: add Google Sheets client and schema validation"
```

## Task 3: Move Teacher Bootstrap And CRUD To Sheets

**Files:**
- Create: `src/lib/google/sheets-bootstrap.ts`
- Create: `src/lib/google/sheets-store.ts`
- Create: `app/api/google-sheet/connect/route.ts`
- Modify: `app/api/google-sheet/validate/route.ts`
- Modify: `app/api/google-sheet/template/route.ts`
- Modify: `app/api/schools/route.ts`
- Modify: `app/api/classes/route.ts`
- Modify: `app/api/students/route.ts`
- Modify: `app/api/sessions/route.ts`
- Modify: `app/api/sessions/[sessionId]/route.ts`
- Modify: `app/teacher/page.tsx`
- Modify: `app/teacher/settings/page.tsx`
- Modify: `app/teacher/students/page.tsx`
- Modify: `app/teacher/sessions/page.tsx`
- Modify: `src/components/teacher/settings-management.tsx`
- Modify: `src/components/teacher/student-table.tsx`
- Modify: `src/components/teacher/session-form.tsx`
- Test: `tests/google/sheets-bootstrap.test.ts`
- Test: `tests/app/teacher-settings-management.test.tsx`
- Test: `tests/app/teacher-session-smoke.test.tsx`

- [ ] **Step 1: Write failing bootstrap tests against sheet rows**

Cover:

```ts
it("builds teacher bootstrap state from 설정/학생명단/세션 tabs")
it("filters inactive students out of selection lists")
it("rejects connect requests when the service account is not shared on the sheet")
it("persists a verified spreadsheet connection through the connect route")
```

- [ ] **Step 2: Run the targeted tests to verify failure**

Run:

```bash
npm run test -- tests/google/sheets-bootstrap.test.ts tests/app/teacher-settings-management.test.tsx
```

Expected: FAIL because CRUD still depends on demo store shapes.

- [ ] **Step 3: Implement sheet-backed teacher bootstrap and CRUD**

Map tabs to domain entities:

- `학생명단` -> students
- `세션` -> sessions
- `설정` -> school metadata

For write operations, update the corresponding tab rows directly.

- [ ] **Step 4: Add the explicit connect route**

Implement:

```ts
POST /api/google-sheet/connect
```

Responsibilities:

- validate sheet URL
- confirm required tabs/headers
- confirm service account access
- persist verified spreadsheet id / link into the school settings tab

- [ ] **Step 5: Switch `createStoreForRequest()` from demo store to sheets store in production path**

Temporary fallback rule:

```ts
if (process.env.NODE_ENV === "test") return createInMemoryTestStore();
return createGoogleSheetsStore();
```

Do not route real runtime traffic through `demo-store`.

- [ ] **Step 6: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/sheets-bootstrap.test.ts tests/app/teacher-settings-management.test.tsx tests/app/teacher-session-smoke.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api app/teacher src/lib/google src/components/teacher tests/google tests/app
git commit -m "feat: move teacher bootstrap and CRUD to Google Sheets"
```

## Task 4: Move Student Submission To Sheets With Success-Only Completion

**Files:**
- Create: `src/lib/google/sheets-submit.ts`
- Modify: `app/api/sessions/[sessionId]/submit/route.ts`
- Modify: `app/session/[sessionId]/page.tsx`
- Modify: `src/components/student/name-picker.tsx`
- Modify: `src/components/student/record-form.tsx`
- Modify: `src/components/student/instant-result-card.tsx`
- Modify: `src/lib/paps/types.ts`
- Test: `tests/google/sheets-submit.test.ts`
- Test: `tests/app/student-submit-sheets.test.tsx`
- Modify: `tests/app/student-session.test.tsx`

- [ ] **Step 1: Write failing submission tests**

Cover:

```ts
it("returns success only when the raw record append succeeds")
it("rejects inactive students even if they know the session url")
it("deduplicates duplicate clientSubmissionKey values when building student-facing results")
it("keeps the student on the form when append fails")
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run:

```bash
npm run test -- tests/google/sheets-submit.test.ts tests/app/student-submit-sheets.test.tsx
```

Expected: FAIL because submit route still writes to demo store first.

- [ ] **Step 3: Implement sheet-backed submit flow**

Required route behavior:

```ts
const result = await store.appendSubmission({
  sessionId,
  studentId,
  measurement,
  clientSubmissionKey,
  submittedAt: now
});

if (!result.ok) {
  return NextResponse.json({ ok: false, error: result.error }, { status: 409 });
}
```

- [ ] **Step 4: Update the student page to create a `clientSubmissionKey` per attempt**

Use a browser-generated UUID and send it with submit payloads.

- [ ] **Step 5: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/sheets-submit.test.ts tests/app/student-submit-sheets.test.tsx tests/app/student-session.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/session app/api/sessions/[sessionId]/submit/route.ts src/lib/google src/components/student src/lib/paps/types.ts tests/google tests/app
git commit -m "feat: move student submission to Google Sheets"
```

## Task 5: Implement Representative Selection, Summary Rebuild, And Duplicate Filtering

**Files:**
- Create: `src/lib/google/sheets-rebuild.ts`
- Create: `app/api/results/rebuild/route.ts`
- Modify: `app/api/records/[recordId]/representative/route.ts`
- Modify: `app/teacher/results/page.tsx`
- Modify: `src/components/teacher/result-table.tsx`
- Modify: `src/components/teacher/sync-status-card.tsx`
- Modify: `src/lib/paps/summaries.ts`
- Modify: `src/lib/google/sheets.ts`
- Test: `tests/google/sheets-rebuild.test.ts`
- Test: `tests/app/teacher-representative.test.tsx`
- Test: `tests/app/teacher-rebuild.test.tsx`

- [ ] **Step 1: Write failing rebuild tests**

Cover:

```ts
it("rebuilds 학생요약 and 공식평가요약 from 기록원본 and 대표값")
it("ignores duplicate clientSubmissionKey rows during summary calculation")
it("marks a record as needing rebuild when one summary tab update fails")
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run:

```bash
npm run test -- tests/google/sheets-rebuild.test.ts tests/app/teacher-rebuild.test.tsx
```

Expected: FAIL with missing rebuild path.

- [ ] **Step 3: Implement representative selection and rebuild**

Add:

- `POST /api/results/rebuild`
- sheet row write helpers for `대표값`, `학생요약`, `공식평가요약`
- duplicate filtering by earliest `clientSubmissionKey`

- [ ] **Step 4: Update teacher results UI**

Expose:

- rebuild-needed state
- `요약 재계산` button
- duplicate warning label when present

- [ ] **Step 5: Wire the rebuild route into the teacher results screen**

Call the rebuild endpoint from the new `요약 재계산` button and refresh the visible summary state on success.

- [ ] **Step 6: Re-run targeted tests**

Run:

```bash
npm run test -- tests/google/sheets-rebuild.test.ts tests/app/teacher-representative.test.tsx tests/app/teacher-rebuild.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/records app/teacher/results/page.tsx src/components/teacher src/lib/google src/lib/paps/summaries.ts tests/google tests/app
git commit -m "feat: add representative rebuild flow for Google Sheets"
```

## Task 6: Remove File Runtime Dependencies And Add Migration Tooling

**Files:**
- Create: `scripts/migrate-demo-store-to-sheets.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `.env.example`
- Delete: `src/lib/db.ts`
- Delete: `src/lib/demo-store.ts`
- Delete: `src/lib/store-path.ts`
- Delete: `src/data/paps/demo.ts`
- Test: `tests/app/teacher-authorization.test.tsx`
- Test: `tests/lib/env.test.ts`

- [ ] **Step 1: Write failing documentation/CLI expectation tests**

Add assertions for:

```ts
expect(readme).toContain("Vercel");
expect(envExample).not.toContain("PAPS_STORE_PATH");
```

If no doc tests exist, add a small script-level unit test around env helpers instead.

- [ ] **Step 2: Run the targeted tests to verify failure**

Run:

```bash
npm run test -- tests/lib/env.test.ts
```

Expected: FAIL because env helpers still advertise file-store settings.

- [ ] **Step 3: Remove file runtime dependencies**

Delete file-store modules only after all earlier tasks are green.

Add migration script behavior:

```bash
node scripts/migrate-demo-store-to-sheets.ts --input <legacy-demo-store-json> --sheet <spreadsheetId>
```

Document the default legacy input path as:

```bash
.data/paps/demo-store.json
```

only if that file actually exists in the operator environment.

- [ ] **Step 4: Update docs and package scripts**

Add scripts like:

```json
{
  "migrate:demo-store": "tsx scripts/migrate-demo-store-to-sheets.ts"
}
```

- [ ] **Step 5: Re-run targeted tests**

Run:

```bash
npm run test -- tests/lib/env.test.ts tests/app/teacher-authorization.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json README.md .env.example scripts tests
git rm src/lib/db.ts src/lib/demo-store.ts src/lib/store-path.ts src/data/paps/demo.ts
git commit -m "refactor: remove file store runtime path"
```

## Task 7: Prepare Vercel Hobby Deployment

**Files:**
- Create: `vercel.json`
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `package.json`
- Test: `tests/app/auth-signin.test.tsx`

- [ ] **Step 1: Write the failing deployment checklist**

Document required env vars and callback URL in `README.md`:

```md
https://<deployment-domain>/api/auth/callback/google
```

- [ ] **Step 2: Add Vercel-specific config**

Include:

- Node runtime compatibility if needed
- no file storage assumptions
- build command and framework defaults only when necessary

- [ ] **Step 3: Run local production verification**

Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all green.

- [ ] **Step 4: Deploy preview to Vercel**

Run:

```bash
vercel deploy -y
```

Expected: preview URL created.

- [ ] **Step 5: Commit**

```bash
git add vercel.json README.md .env.example package.json
git commit -m "chore: prepare Vercel deployment"
```

## Final Verification

- [ ] Run:

```bash
npm run lint
npm test
npm run build
```

Expected: all commands succeed.

- [ ] Run an authenticated preview deploy:

```bash
vercel deploy -y
```

Expected: preview URL returned without file-system runtime errors.

- [ ] Smoke check manually:

- 교사 로그인 페이지 진입
- 시트 연결 검증
- 세션 생성
- 학생 제출 성공
- 대표값 선택
- 요약 재계산

- [ ] Final commit if any verification fixes were needed:

```bash
git add -A
git commit -m "test: finish Sheets migration verification"
```
