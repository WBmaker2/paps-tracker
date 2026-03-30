# 백엔드 구현 계획

## 기능명

- 교사 결과 화면 필터 및 검색 패널

## 목표

- 프론트엔드가 문자열 파싱 없이 신뢰할 수 있는 결과 view model을 서버가 제공한다.
- `학년`, `반`, `학생명`, `종목`, `세션 유형` 필터를 가능하게 할 메타데이터를 서버 단계에서 정리한다.
- 기존 대표값 선택 및 요약 재계산 API를 유지하면서도, 필터 기능이 붙어도 데이터 기준이 흔들리지 않게 만든다.

## 핵심 결정

- 새 필터 전용 HTTP API는 1차 구현에서 만들지 않는다.
- 대신 `/teacher/results` 서버 페이지가 `teacher가 접근 가능한 세션 범위`에서 결과 row를 모두 모아 `TeacherResultsViewModel`로 만든다.
- 즉, 이번 백엔드 작업의 중심은 `endpoint 추가`보다 `서버-side aggregation + view model builder`다.

## 추천 접근

### 현재 방식의 문제

- 현재 결과 페이지는 `selectPrimaryResultsSession()`으로 고른 단일 세션만 읽고 있다.
- 이 구조에서는 `세션 유형`, `종목`, `학년` 필터가 사실상 무의미해질 수 있다.

### 1차 구현 권장안

- `bootstrap.sessions` 범위에서 교사에게 보이는 세션들을 정렬한다.
- 각 세션에 대해 `store.listSessionRecords(session.id)`를 호출해 row를 누적한다.
- 누적 row를 표준 shape인 `TeacherResultRowView[]`로 변환한다.
- 필터 옵션과 초기 포커스도 이 집계 결과를 기준으로 계산한다.

이 방식이면 새 endpoint 없이도 기능 요구를 살릴 수 있다.

## 작업 단위

### 1. 결과 view model 빌더 분리

#### 대상 파일

- [src/lib/teacher-results.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/teacher-results.ts)
- [app/teacher/results/page.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx)

#### 작업 내용

- 현재 `page.tsx` 안에 흩어져 있는 row 생성 로직을 별도 helper로 이동한다.
- 추천 이름:
  - `buildTeacherResultsViewModel`
  - `buildTeacherResultRows`
  - `buildTeacherResultFilterOptions`
- `TeacherResultRow` 타입을 client component 파일 밖으로 옮겨 공유 가능하게 만든다.

#### 이유

- 지금은 서버 페이지가 client component 타입을 직접 참조하고 있어 역할 경계가 흐리다.
- 필터 기능이 들어오면 row metadata와 파생 옵션 계산이 늘어나므로, 전용 helper가 필요하다.

### 2. 세션 범위 확장

#### 대상 파일

- [app/teacher/results/page.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx)
- [src/lib/teacher-results.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/teacher-results.ts)

#### 작업 내용

- 기존 `activeSession` 단일 조회 대신, 결과 화면 표시용 세션 목록을 정렬해 사용한다.
- 추천 정렬 기준:
  1. 열려 있는 세션 우선
  2. 최신 `createdAt` 우선
  3. `id` 안정 정렬

#### 주의

- 오른쪽 그래프와 동기화 상태용 `초기 포커스 row`는 여전히 필요하다.
- 따라서 `selectPrimaryResultsSession()`는 완전히 제거하기보다, `initialFocusRecordId` 계산의 일부로만 남길 수 있다.

### 3. row metadata 확장

#### 필요한 필드

- `gradeLevel`
- `classId`
- `classNumber`
- `eventId`
- `sessionType`
- `studentNameNormalized`
- `schoolId`

#### 데이터 소스

- `student`:
  - `student.id`
  - `student.name`
  - `student.gradeLevel`
  - `student.studentNumber`
  - `student.schoolId`
- `classroom`:
  - `classroom.id`
  - `classroom.label`
  - `classroom.classNumber`
- `session`:
  - `session.id`
  - `session.name`
  - `session.eventId`
  - `session.sessionType`
  - `session.createdAt`

#### 구현 메모

- row 생성 시점에 `studentsById`, `classesById`, `sessionsById` map을 먼저 만든다.
- 문자열 parsing보다는 원본 구조체 참조를 우선한다.

### 4. filter options 생성

#### 대상 helper

- `buildTeacherResultFilterOptions(rows)`

#### 출력

- `grades`
- `classes`
- `events`
- `sessionTypes`

#### 규칙

- 옵션은 중복 제거 후 정렬한다.
- `classes`는 `gradeLevel`을 같이 내린다.
- `sessionTypes`는 항상 `all`, `official`, `practice` 순서 유지

### 5. 포커스 및 보조 카드 데이터 정리

#### 대상 파일

- [app/teacher/results/page.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx)
- [src/lib/teacher-results.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/teacher-results.ts)

#### 작업 내용

- `initialFocusRecordId`를 서버에서 계산한다.
- `syncStatusByRecordId`, `syncMessageByRecordId` 형태의 lookup 또는 최소한 찾기 쉬운 구조를 준비한다.
- 클라이언트 워크스페이스가 포커스 row에 맞는 sync 상태를 쉽게 찾을 수 있게 한다.

#### 추천

- 1차는 단순한 map 객체로 충분하다.

### 6. 기존 mutation endpoint 유지

#### 유지 대상

- [app/api/records/[recordId]/representative/route.ts](/Volumes/DATA/Dev/Codex/paps-tracker/app/api/records/%5BrecordId%5D/representative/route.ts)
- [app/api/results/rebuild/route.ts](/Volumes/DATA/Dev/Codex/paps-tracker/app/api/results/rebuild/route.ts)

#### 작업 원칙

- 대표값 선택 route는 그대로 둔다.
- 요약 재계산 route도 그대로 둔다.
- 이번 기능 때문에 응답 포맷을 불필요하게 바꾸지 않는다.

#### 보완 메모

- 다만 프론트가 row state를 상위에서 관리하게 되면, representative route 성공 응답에서 필요한 필드가 충분한지 재확인한다.
- 현재는 `record.representativeAttemptId` 중심 응답으로도 충분한 편이다.

### 7. Google Sheets / store 계층 영향 범위 확인

#### 대상 파일

- [src/lib/google/sheets-store.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/google/sheets-store.ts)
- [src/lib/store/paps-store.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/store/paps-store.ts)
- [src/lib/store/paps-store-types.ts](/Volumes/DATA/Dev/Codex/paps-tracker/src/lib/store/paps-store-types.ts)

#### 작업 내용

- 새 endpoint가 없으므로 store 인터페이스를 크게 바꿀 필요는 없다.
- 다만 `TeacherResultsViewModel` 생성을 위해 필요한 필드가 bootstrap에 모두 있는지 확인한다.
- 부족하면 store API 확장보다 `bootstrap + listSessionRecords(sessionId)` 조합으로 해결하는 것을 우선한다.

#### 판단

- 현재 구조상 필요한 데이터는 대부분 이미 `bootstrap`과 `listSessionRecords`로 충족 가능하다.
- 따라서 store 계층 변경은 최소화하는 것이 좋다.

## 테스트 계획

### 새 테스트 후보

- [tests/lib/teacher-results-view-model.test.ts](/Volumes/DATA/Dev/Codex/paps-tracker/tests/lib/teacher-results-view-model.test.ts)

#### 검증 항목

- 여러 세션을 합쳐 row가 생성된다
- row에 `gradeLevel`, `classId`, `eventId`, `sessionType`이 포함된다
- filter options가 중복 없이 계산된다
- `initialFocusRecordId`가 정렬 규칙에 맞게 잡힌다

### 기존 테스트 보강

- [tests/app/teacher-results-page.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx)
- [tests/app/teacher-results-selection.test.ts](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-selection.test.ts)

#### 보강 내용

- page가 단일 세션이 아니라 여러 세션 row 집계를 준비해도 정상 렌더링되는지
- 초기 포커스 계산이 기존 의도와 어긋나지 않는지

## 구현 순서

1. `TeacherResultRow` 타입을 공유 가능한 위치로 이동
2. `buildTeacherResultsViewModel` helper 추가
3. 여러 세션 기반 row 집계 로직 구현
4. filter options / initial focus 계산 추가
5. `page.tsx`를 새 helper 사용 구조로 정리
6. 테스트 보강

## 리스크와 대응

### 리스크 1. 세션 수가 많아지면 서버 페이지 로딩 비용 증가

- 대응:
  - 1차는 교사 가시 범위 세션 수를 그대로 사용
  - 실제 성능 이슈가 보이면 2차에서 서버 필터 API 또는 기간 제한 도입

### 리스크 2. 학생 학년과 세션 학년이 불일치하는 데이터

- 대응:
  - row 생성 단계에서 경고 대상으로 본다
  - 프론트에서 임의 보정하지 않는다

### 리스크 3. 단일 세션 기준으로 짜인 기존 동기화 카드 로직이 복잡해질 수 있음

- 대응:
  - `recordId` 기반 lookup map을 먼저 만들고, 클라이언트는 포커스 row 기준으로만 읽게 한다

## 백엔드 워커 성공 기준

- 새 endpoint 없이도 필터 기능에 필요한 결과 데이터가 서버에서 준비된다.
- 프론트가 row metadata를 파싱 없이 사용한다.
- 기존 대표값 선택/요약 재계산 흐름이 깨지지 않는다.
- 테스트, 린트, 빌드로 검증 가능한 구조가 된다.
