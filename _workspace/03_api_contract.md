# API 계약

## 기능명

- 교사 결과 화면 필터 및 검색 패널

## 계약 목표

- 결과 화면 필터 기능을 위해 프론트엔드가 필요한 메타데이터를 서버가 명시적으로 제공한다.
- 프론트는 문자열을 억지로 파싱하지 않고, 안정적인 view model shape만 소비한다.
- 대표값 선택과 요약 재계산 API는 유지하되, 필터 상태와 공존할 수 있는 최소 응답 계약을 명확히 한다.

## 1차 구현 원칙

- 1차 구현에서는 `새 필터 전용 HTTP endpoint`를 만들지 않는다.
- 필터는 `teacher/results` 페이지가 서버에서 준비한 결과 데이터를 클라이언트에서 즉시 좁히는 방식으로 동작한다.
- 따라서 이번 기능의 핵심 계약은 `서버 페이지 -> 클라이언트 워크스페이스` 사이의 `view model contract`이다.

## 데이터 흐름

1. 서버 페이지가 `loadTeacherPageState()`와 `store.listSessionRecords()`를 사용해 결과 데이터를 모은다.
2. 서버는 필터에 필요한 메타데이터를 포함한 `TeacherResultsViewModel`을 만든다.
3. 클라이언트 `TeacherResultsWorkspace`가 이 모델을 받아 필터 UI와 결과 목록을 렌더링한다.
4. 대표값 선택은 기존 `PATCH /api/records/:recordId/representative`를 호출한다.
5. 요약 재계산은 기존 `POST /api/results/rebuild`를 호출한다.

## 서버 뷰모델 계약

### `TeacherResultsViewModel`

```ts
interface TeacherResultsViewModel {
  rows: TeacherResultRowView[];
  filterOptions: TeacherResultFilterOptions;
  initialFocusRecordId: string | null;
  summariesNote: string;
}
```

### `TeacherResultRowView`

```ts
interface TeacherResultRowView {
  recordId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  studentNameNormalized: string;
  studentNumber: number | null;
  classId: string;
  classLabel: string;
  classNumber: number | null;
  gradeLevel: 3 | 4 | 5 | 6;
  schoolId: string | null;
  sessionName: string;
  sessionType: "official" | "practice";
  eventId: EventId;
  eventLabel: string;
  unit: string;
  representativeAttemptId: string | null;
  attempts: PAPSAttempt[];
  duplicateAttemptCount: number;
}
```

### 필드 의미

- `studentNameNormalized`
  - 검색용 소문자/trim 기준 이름
  - 프론트에서 별도 normalize 유틸을 강제하지 않기 위해 서버에서 제공
- `classId`
  - 반 필터와 포커스 유지 판단에 사용
- `classNumber`
  - 표시 및 정렬 보조용
- `gradeLevel`
  - 학년 필터에 사용
- `sessionType`
  - `공식` / `연습` 필터에 사용
- `eventId`
  - 종목 필터와 안정적인 비교에 사용

### `TeacherResultFilterOptions`

```ts
interface TeacherResultFilterOptions {
  grades: Array<{
    value: 3 | 4 | 5 | 6;
    label: string;
  }>;
  classes: Array<{
    value: string;
    label: string;
    gradeLevel: 3 | 4 | 5 | 6;
  }>;
  events: Array<{
    value: EventId;
    label: string;
  }>;
  sessionTypes: Array<{
    value: "all" | "official" | "practice";
    label: string;
  }>;
}
```

### 계약 규칙

- 옵션 목록은 `rows` 기준으로 서버에서 계산한다.
- `classes`는 `gradeLevel`을 함께 제공해 프론트가 학년 선택 후 반 옵션을 안전하게 좁힐 수 있게 한다.
- `sessionTypes`는 항상 `all`, `official`, `practice`를 같은 순서로 제공한다.

## 프론트 필터 state 계약

```ts
interface TeacherResultsFilterState {
  query: string;
  grade: "all" | 3 | 4 | 5 | 6;
  classId: "all" | string;
  eventId: "all" | EventId;
  sessionType: "all" | "official" | "practice";
}
```

### 동작 규칙

- `query`는 `studentNameNormalized` 기준 포함 검색
- `grade`가 바뀌면 현재 `classId`가 유효한지 다시 검증
- 유효하지 않으면 `classId`는 자동으로 `all`로 초기화
- 필터는 `rows` 배열에 순수 함수로 적용 가능해야 한다

## 포커스 row 계약

### 입력

- `initialFocusRecordId`

### 규칙

- 최초 렌더에서는 `initialFocusRecordId`가 있으면 해당 row를 포커스로 사용한다.
- 필터 적용 후에도 현재 포커스 row가 남아 있으면 유지한다.
- 현재 포커스 row가 필터로 제외되면 첫 번째 filtered row를 포커스로 바꾼다.
- filtered row가 0건이면 포커스는 `null`

## 기존 endpoint 유지 계약

### `PATCH /api/records/:recordId/representative`

- 목적:
  - 특정 학생 record의 대표 시도를 선택한다.
- 요청 body:

```json
{
  "attemptId": "attempt-123",
  "reason": "optional"
}
```

- 성공 응답:

```json
{
  "record": {
    "sessionId": "session-1",
    "studentId": "student-1",
    "eventId": "sit-and-reach",
    "unit": "cm",
    "attempts": [],
    "representativeAttemptId": "attempt-123"
  }
}
```

- 실패 응답:

```json
{
  "error": "message"
}
```

### 프론트 반응 규칙

- 성공 시 현재 필터 state는 유지한다.
- `recordId`가 현재 filtered list 안에 있으면 해당 row의 `representativeAttemptId`만 갱신한다.
- 성공 후 전체 목록을 즉시 재요청하지 않는다.

### `POST /api/results/rebuild`

- 목적:
  - 학생요약/공식평가요약을 다시 계산한다.
- 요청 body:
  - 없음
- 성공 응답:
  - 기존 route 계약 유지
- 프론트 반응:
  - 현재 필터 state는 유지
  - rebuild 성공 메시지 또는 상태만 갱신

## 이번 단계에서 만들지 않는 것

- `GET /api/results?grade=...` 형태의 서버 필터 API
- URL query 기반 필터 상태 보존
- 시트 요약표를 필터 결과 기준으로 다시 계산하는 API

## 데이터 모델 메모

- 현재 `TeacherResultRow`에는 필터에 필요한 필드가 일부 빠져 있다.
- 이번 기능 구현 전에 서버에서 row를 만들 때 최소 다음 정보를 추가 제공해야 한다.
  - `gradeLevel`
  - `classId`
  - `classNumber`
  - `eventId`
  - `sessionType`
  - `studentNameNormalized`
- `sessionType`은 `PAPSSession.sessionType`에서 직접 가져온다.
- `gradeLevel`은 학생 기준과 세션 기준이 모두 가능하지만, 표시/필터 일관성을 위해 `student.gradeLevel`과 `session.gradeLevel`이 다르면 세션 로딩 시점에 경고 대상으로 본다.

## 프론트 의존 포인트

- 필터 UI는 다음 데이터를 신뢰하고 직접 파생 계산을 최소화한다.
  - `rows`
  - `filterOptions`
  - `initialFocusRecordId`
- `ResultTable`은 row 배열을 그대로 받고, 필터 자체는 상위 워크스페이스에서 처리한다.
- `TeacherProgressChart`와 `SyncStatusCard`는 `focusedRow` 기반으로만 동작한다.
- `SummaryExportsCard`는 이번 단계에서 기존 `sheetTabs` 계약을 그대로 유지한다.

## 실패 및 엣지 케이스

- 결과 row는 있지만 필터 후 0건:
  - 200 응답 유지
  - 프론트에서 빈 상태 처리
- 어떤 row에 `gradeLevel` 또는 `sessionType`이 비어 있음:
  - 서버에서 view model 생성 시 기본값을 추측하지 말고 해당 row를 제외하거나 경고 로그 대상으로 삼는다.
- 대표값 선택 직후 현재 row가 필터와 충돌:
  - 대표값 선택 자체는 성공 처리
  - 필터는 유지
  - row 포함 여부는 필터 함수 결과에 따른다

## 향후 확장 메모

- row 수가 커져 클라이언트 필터링 비용이 의미 있어지면, 2단계에서 서버 필터 API를 추가할 수 있다.
- 그때도 현재 `TeacherResultRowView` shape를 그대로 응답 본문으로 재사용하면 마이그레이션 비용이 낮다.
