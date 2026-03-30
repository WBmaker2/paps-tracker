# 프론트엔드 구현 계획

## 기능명

- 교사 결과 화면 필터 및 검색 패널

## 목표

- `/teacher/results` 화면에 교사용 필터/검색 경험을 추가한다.
- 필터 상태와 포커스 학생 상태를 분리해, 대표값 선택과 공존하도록 만든다.
- 기존 결과 화면의 정보 구조를 무너뜨리지 않고 확장한다.

## 구현 전략

- 서버 페이지는 `TeacherResultsViewModel` 형태의 데이터를 준비한다.
- 클라이언트 측에 새 워크스페이스 컴포넌트를 추가해 필터 state, 포커스 row 계산, 결과 개수 요약을 담당하게 한다.
- 기존 `ResultTable`, `TeacherProgressChart`, `SyncStatusCard`, `SummaryExportsCard`는 최대한 재사용한다.
- 1차 구현은 `클라이언트 필터링`으로 진행한다.

## 작업 단위

### 1. 결과 화면 view model 정리

#### 대상 파일

- [app/teacher/results/page.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/app/teacher/results/page.tsx)
- [src/components/teacher/result-table.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/result-table.tsx)

#### 작업 내용

- 현재 서버에서 직접 만드는 `TeacherResultRow`를 `TeacherResultRowView` 수준으로 확장한다.
- 필터에 필요한 메타데이터를 row에 추가한다.
  - `gradeLevel`
  - `classId`
  - `classNumber`
  - `eventId`
  - `sessionType`
  - `studentNameNormalized`
- 페이지 내부에서 바로 `ResultTable`을 렌더링하지 않고, 새 클라이언트 컴포넌트에 `rows`, `sheetTabs`, `focusSync` 관련 데이터, 안내 문구를 넘기도록 바꾼다.

#### 완료 조건

- 서버 페이지가 필터 구현에 필요한 데이터를 모두 내려준다.
- 기존 empty state와 sheet-connected 분기 흐름이 깨지지 않는다.

### 2. 결과 워크스페이스 컴포넌트 추가

#### 새 파일 후보

- [src/components/teacher/teacher-results-workspace.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/teacher-results-workspace.tsx)

#### 책임

- 필터 state 관리
- filtered rows 계산
- 포커스 row 계산
- 결과 개수/활성 필터 요약 렌더링
- 오른쪽 카드에 넘길 현재 포커스 row 결정

#### 내부 state

```ts
{
  query: string;
  grade: "all" | GradeLevel;
  classId: "all" | string;
  eventId: "all" | EventId;
  sessionType: "all" | "official" | "practice";
  focusedRecordId: string | null;
}
```

#### 완료 조건

- 필터 상태를 한 곳에서 관리한다.
- 필터 결과가 바뀌어도 포커스 규칙이 일관되게 동작한다.

### 3. 필터 패널 컴포넌트 추가

#### 새 파일 후보

- [src/components/teacher/results-filter-panel.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/results-filter-panel.tsx)

#### 책임

- 검색 입력
- 학년 드롭다운
- 반 드롭다운
- 종목 드롭다운
- 세션 유형 segmented control
- `필터 초기화` 버튼

#### UI 요구사항

- 결과 카드와 동일한 둥근 카드 톤 유지
- 상단 제목: `검색 및 필터`
- 설명: `학년, 반, 종목, 세션 유형으로 결과를 빠르게 좁혀 볼 수 있습니다.`

#### 완료 조건

- 모든 입력이 controlled 상태로 동작한다.
- 학년 변경 시 반 옵션 무효화 규칙이 적용된다.

### 4. 결과 개수 및 활성 필터 요약 표시

#### 구현 위치

- `teacher-results-workspace.tsx` 내부 또는 별도 작은 presentational 컴포넌트

#### 책임

- `현재 n건 / 전체 m건` 표시
- 활성 필터 pill 렌더링
- 빈 결과 상태 안내

#### 완료 조건

- 필터 결과가 즉시 숫자로 반영된다.
- 빈 결과 상태에서 `필터 초기화` 액션이 보인다.

### 5. ResultTable을 필터 친화적으로 정리

#### 대상 파일

- [src/components/teacher/result-table.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/result-table.tsx)

#### 작업 내용

- row type 확장에 맞춰 타입 정리
- 제목/설명 문구를 핸드오프 기준으로 조정
- empty rows일 때도 어색하지 않도록 표시 개선
- 대표값 선택 성공 시 상위 워크스페이스가 포커스를 유지할 수 있게 필요한 콜백 또는 상태 동기화 지점 검토

#### 권장 방향

- 대표값 선택 API 호출은 `ResultTable` 내부에 남겨도 된다.
- 다만 `items`를 내부 state로 복제하는 현재 구조는 상위 filtered rows와 어긋날 수 있으므로 다음 둘 중 하나로 정리한다.
  - 상위가 row state를 소유하고 하위는 callback만 호출
  - 하위가 내부 state를 유지하되 외부 rows 변경 시 동기화하는 로직 추가

#### 추천

- 이번 기능부터는 `teacher-results-workspace`가 row state를 소유하고, `ResultTable`은 좀 더 dumb component에 가깝게 바꾸는 쪽을 추천한다.

### 6. 오른쪽 보조 패널 연동

#### 대상 파일

- [src/components/charts/teacher-progress-chart.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/charts/teacher-progress-chart.tsx)
- [src/components/teacher/sync-status-card.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/sync-status-card.tsx)
- [src/components/teacher/summary-exports-card.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/src/components/teacher/summary-exports-card.tsx)

#### 작업 내용

- 필터 결과가 0건일 때 그래프/동기화 카드의 empty handling 추가
- 요약 카드 상단에 안내 문구 추가
  - `이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다.`

#### 완료 조건

- 필터 결과와 오른쪽 보조 패널의 기준이 사용자에게 명확하다.

## 테스트 계획

### 우선 추가할 테스트

#### 대상 파일

- [tests/app/teacher-results-page.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx)

#### 추가 검증

- `검색 및 필터` 카드가 보인다
- `학생요약 미리보기` / `공식평가요약 미리보기`는 계속 보인다
- 전체 시트 기준 안내 문구가 보인다

#### 새 클라이언트 컴포넌트 테스트 후보

- [tests/app/teacher-results-workspace.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-workspace.test.tsx)

#### 검증 항목

- 이름 검색 시 row가 좁혀진다
- 학년 선택 시 반 옵션이 좁혀진다
- 세션 유형 `공식`/`연습` 필터가 동작한다
- 필터 결과가 0건이면 빈 상태가 보인다
- 필터 적용 후에도 대표값 선택 callback 흐름이 유지된다
- 현재 포커스 row가 필터 결과에 따라 올바르게 유지/재선택된다

### 회귀 확인

- `요약 XLSX 다운로드` 링크는 그대로 보여야 한다
- `요약 재계산` 버튼은 그대로 작동해야 한다
- 기존 result page snapshot 수준 의미 테스트는 유지한다

## 구현 순서

1. `TeacherResultRowView` 타입과 서버 row shape 확장
2. `TeacherResultsWorkspace` 추가
3. `ResultsFilterPanel` 추가
4. `ResultTable`을 상위 state 친화적으로 정리
5. 오른쪽 패널 empty handling 및 안내 문구 추가
6. 테스트 보강

## 리스크와 대응

### 리스크 1. ResultTable 내부 state와 상위 filtered state 충돌

- 대응:
  - row 상태 소유권을 상위로 올리는 방향을 우선 검토한다.

### 리스크 2. 현재 결과 페이지가 activeSession 중심이라 필터 범위가 작아 보일 수 있음

- 대응:
  - 1차 구현에서는 `현재 서버가 로드한 결과 범위 안에서만 필터링`한다고 명확히 문구화한다.

### 리스크 3. 모바일에서 필터 패널이 너무 길어짐

- 대응:
  - 검색 입력은 단독 행
  - 선택 필터는 2열 반응형
  - 세션 유형은 짧은 segmented control 유지

## 프론트엔드 워커 성공 기준

- 디자인 핸드오프 문구와 상태 정의가 실제 UI에 반영된다.
- 결과 검색과 필터가 빠르게 동작한다.
- 대표값 선택/요약/다운로드 흐름이 깨지지 않는다.
- 테스트, 린트, 빌드가 통과한다.
