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

---

# API 계약: 체지방 제외 4요인 회차 점수·등급

## 계약 상태와 적용 범위

- 승인일: 2026-08-26
- 이 섹션은 `docs/superpowers/plans/2026-08-26-paps-four-factor-round-score-grade.md`의 승인된 구현 경계를 API·저장소·Google Sheets 관점에서 고정한다.
- 아래에서 **요구**는 서버가 반드시 검증해야 하는 항목, **금지**는 요청·응답·저장에 포함해서는 안 되는 항목을 뜻한다.
- 이 결과는 학교건강검사규칙의 공식 5요인 종합점수·종합등급이 아니다. 모든 사용자 표시명과 export 명칭은 `체지방 제외 4요인 환산 결과`를 사용한다.
- 회차의 평가 요인은 다음 네 개뿐이다. 각 요인에서 정확히 하나의 기존 `EventId`를 선택한다.

```ts
type PAPSFourFactorId =
  | "cardiorespiratory-endurance"
  | "flexibility"
  | "strength-endurance"
  | "power";

type AssessmentRoundType = "regular" | "followUp";
type AssessmentRoundStatus = "draft" | "open" | "review" | "finalized" | "archived";
type StudentRoundResultStatus =
  | "incomplete"
  | "excluded"
  | "ready"
  | "finalized"
  | "stale";
```

요청·응답·시트 열에는 위 네 요인 외의 신체요인 필드를 만들지 않는다. 특히 BMI, 체지방 측정값, 체지방 점수, 체지방 등급을 선택·입력·계산·검증·저장하는 필드는 없다. `체지방 제외 환산점수`처럼 결과의 제외 범위를 설명하는 표시명은 허용하지만, 별도의 입력값이나 계산 요인은 아니다.

## 1. 계산 원자 계약

### 1.1 요인과 종목 선택

```ts
type SelectedEventsByFactor = Record<PAPSFourFactorId, EventId>;
```

- `selectedEventsByFactor`에는 네 키가 모두 한 번씩 존재해야 한다.
- 값은 현재 `src/lib/paps/types.ts`의 `EventId`만 허용한다.
- 선택된 종목은 대상 반의 모든 학년과 회차의 세션 유형에 적격해야 한다. 적격성은 클라이언트가 보낸 결과가 아니라 서버의 `catalog`와 `validation` 규칙으로 다시 검증한다.
- 한 요인에 두 종목을 연결하거나, 네 요인 밖의 종목을 추가하는 요청은 거부한다.
- 기존 종목별 대표 시도(`representativeAttemptId`) 하나가 요인 점수의 입력이다. 최신 시도를 자동으로 대표값으로 바꾸지 않는다.

### 1.2 점수와 등급

```ts
interface FourFactorCalculation {
  cardiorespiratoryEndurance: number; // integer, 0..20
  flexibility: number;                 // integer, 0..20
  strengthEndurance: number;           // integer, 0..20
  power: number;                       // integer, 0..20
  fourFactorSubtotal: number;          // integer, 0..80
  normalizedScore: number;             // 0..100, subtotal * 1.25
  fourFactorGrade: 1 | 2 | 3 | 4 | 5;
}
```

서버는 대표 시도의 원측정값을 종목·학년·성별별 세부 규칙으로 먼저 0~20 정수로 변환한 뒤 다음 순서로 계산한다. 세부 규칙은 `ruleVersion` fixture로 고정하며, 보간이나 임의 반올림으로 대체하지 않는다.

항목별 0~20점의 등급 내부 배분은 별표 5 방식의 계약을 따른다. 5등급은 내부 점수 1~3점 구간을 사용하고, 4등급·3등급·2등급·1등급은 각각 4점 구간을 사용한다. 최저 원점수 0은 계산기의 유효한 바닥값으로 허용하되, 어떤 원측정값이 어느 점수·등급에 대응하는지는 `ruleVersion`별 lookup fixture가 모든 경계를 열거해야 한다. 따라서 구현자는 `factorScore`만 저장하거나 등급을 역산하지 않고, 원측정값·요인점수·규칙 버전을 함께 저장한다.

```text
fourFactorSubtotal = cardio + flexibility + strengthEndurance + power
normalizedScore = fourFactorSubtotal * 1.25
```

| `fourFactorSubtotal` | `normalizedScore` | `fourFactorGrade` |
|---:|---:|---:|
| 64~80 | 80~100 | 1 |
| 48~63 | 60~78.75 | 2 |
| 32~47 | 40~58.75 | 3 |
| 16~31 | 20~38.75 | 4 |
| 0~15 | 0~18.75 | 5 |

- 등급은 표시된 환산점수를 반올림한 값이 아니라 정수 합계의 경계로 판정한다.
- `normalizedScore`는 저장 시 계산된 숫자를 보존하고, 화면 표시만 소수 첫째 자리로 포맷한다.
- 확정 snapshot은 `fourFactorSubtotal`과 `normalizedScore`를 모두 저장한다. 둘 중 하나만 저장하고 나중에 재계산하는 방식은 허용하지 않는다.
- 네 대표 시도가 모두 없거나 하나라도 점수 규칙을 통과하지 못하면 `fourFactorSubtotal`, `normalizedScore`, `fourFactorGrade`를 만들지 않는다(`null`). 미측정을 0점으로 대체하지 않는다.
- 계산에는 `ruleVersion`과 `ruleSource`가 필수이며, 클라이언트가 보낸 합계·환산점수·등급은 무시하고 서버가 원자료에서 재계산한다.

## 2. 저장 도메인 타입

아래는 TypeScript 구현자가 그대로 옮길 수 있는 논리 계약이다. 실제 타입은 기존 모듈의 `GradeLevel`, `EventId`, `StudentSex`, `PAPSSession` 타입을 재사용한다.

```ts
interface PAPSAssessmentRound {
  id: string;
  name: string;
  academicYear: number;
  schoolId: string;
  teacherId: string;
  roundType: AssessmentRoundType;
  roundNumber: number;
  status: AssessmentRoundStatus;
  classTargets: Array<{ classId: string; gradeLevel: GradeLevel }>;
  selectedEventsByFactor: SelectedEventsByFactor;
  sessionIdsByFactor: Record<PAPSFourFactorId, string>;
  ruleVersion: string;
  ruleSource: string;
  revision: number;
  createdAt: string;
  openedAt: string | null;
  finalizedAt: string | null;
  archivedAt: string | null;
}

interface PAPSFactorResultSnapshot {
  factorId: PAPSFourFactorId;
  eventId: EventId;
  sessionId: string;
  representativeAttemptId: string | null;
  measurement: number | null;
  factorScore: number | null; // null until the representative record is valid
}

interface PAPSStudentRoundResult {
  roundId: string;
  studentId: string;
  revision: number; // last persisted result revision; starts at 0 when no snapshot exists
  status: StudentRoundResultStatus;
  studentSnapshot: {
    name: string;
    sex: StudentSex;
    gradeLevel: GradeLevel;
    classId: string;
    classNumber: number | null;
    studentNumber: number | null;
  };
  factors: Record<PAPSFourFactorId, PAPSFactorResultSnapshot>;
  fourFactorSubtotal: number | null;
  normalizedScore: number | null;
  fourFactorGrade: 1 | 2 | 3 | 4 | 5 | null;
  ruleVersion: string;
  ruleSource: string;
  sourceFingerprint: string | null;
  calculatedAt: string | null;
  finalizedAt: string | null;
  finalizedBy: string | null;
  previousRevision: number | null;
}
```

`sourceFingerprint`는 `roundId`, 회차 `revision`, 네 요인의 session/event/대표 시도 ID/원측정값, `ruleVersion`을 정규화한 문자열의 SHA-256과 같이 결정적으로 생성한다. 프론트가 만든 fingerprint는 신뢰하지 않는다. `stale`는 마지막 확정 snapshot을 삭제하거나 덮어쓰지 않고, 최신 원자료 fingerprint와 저장된 fingerprint가 달라졌음을 뜻한다.

### 2.1 상태 의미와 전이

#### 회차 상태

| 현재 | 사건 | 다음 | 저장 규칙 |
|---|---|---|---|
| `draft` | 교사가 회차를 개방 | `open` | `openedAt`을 한 번 기록한다. |
| `open` | 하나 이상의 학생 결과가 검토 가능 | `review` | 서버가 조회 시 파생하거나 명시적 개방 상태 변경으로 저장한다. |
| `review` | 모든 대상 학생이 `finalized` 또는 `excluded` | `finalized` | `finalizedAt`을 기록한다. |
| `finalized` | 원자료가 바뀌어 재검토가 필요 | `review` | 기존 학생 확정 snapshot은 보존하고 영향받은 결과를 `stale`로 표시한다. |
| `draft/open/review/finalized` | 교사가 보관 | `archived` | 이후 측정·확정 mutation을 금지한다. |

회차 상태는 학생 결과 상태를 대신하지 않는다. 회차가 `review`여도 학생별로 `incomplete`, `excluded`, `ready`, `finalized`, `stale`가 함께 존재할 수 있다.

#### 학생 결과 상태

| 현재 | 사건 | 다음 | 허용 결과 |
|---|---|---|---|
| 없음 또는 `incomplete` | 네 대표 시도가 모두 유효 | `ready` | 계산값을 미리보기로 제공하며 아직 영구 확정하지 않는다. |
| 없음 또는 `incomplete`/`ready` | 교사가 측정 제외를 확정 | `excluded` | 네 요인 snapshot과 모든 점수 필드는 `null`이다. |
| `ready` | 단건 확정 성공 | `finalized` | 새 `revision`을 저장한다. |
| `finalized` | 대표 시도·원측정값·규칙·연결 회차가 변경 | `stale` | 이전 확정 revision은 읽기 전용으로 보존한다. |
| `stale` | 최신 네 요인이 모두 유효 | `ready` | 재계산 결과를 미리보기로 만들고 다음 확정 시 새 revision을 만든다. |
| `stale` | 교사가 측정 제외를 확정 | `excluded` | 새 revision을 저장하고 이전 확정본은 보존한다. |

- `incomplete`, `excluded`, `stale` 결과는 현재 유효한 확정 결과로 표시하지 않는다.
- `stale` 조회에서는 감사 추적을 위해 직전 snapshot을 반환할 수 있지만 `isCurrent=false`를 함께 반환하고, 최종 결과 카드·학생 화면·export의 현재 값으로 사용하지 않는다.
- `ready`는 최신 원자료에서 계산된 ephemeral 상태이며, preview만으로 revision을 올리거나 Google Sheets 행을 쓰지 않는다.
- `excluded`를 다시 측정 대상으로 되돌리는 별도 API가 생기기 전까지는 같은 회차의 학생 제출을 확정 결과로 자동 승격하지 않는다. 재개는 교사가 회차를 다시 검토하는 명시적 mutation으로만 허용한다.

## 3. 공통 HTTP 계약

### 3.1 인증과 소유권

- `/api/assessment-rounds*`의 모든 요청은 기존 교사 세션 인증(`requireTeacherRouteSession`)을 통과해야 한다.
- 회차·반·학생·연결 세션이 교사의 `schoolId`에 속하지 않으면 `403 FORBIDDEN`을 반환한다. 존재 여부를 외부에 노출하지 않는 경로에서는 동일한 `404`로 감출 수 있다.
- 학생용 측정 제출은 기존 세션 access token 흐름을 그대로 사용하며, 새 회차 endpoint에 학생 access token을 허용하지 않는다.
- 모든 mutation 응답에는 가능하면 `requestId`와 현재 `roundRevision`을 포함한다. 기존 route의 헤더·live update 방식은 유지한다.

### 3.2 요청·응답 공통 shape

```ts
interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId: string;
}

interface ApiErrorResponse {
  error: ApiError;
}

interface MutationHeaders {
  "Idempotency-Key": string; // 1..128자, printable ASCII
  "If-Match-Revision": string; // 양의 정수 또는 0
}
```

- 새 회차 mutation은 구조화된 `{ error: { code, message, ... } }`를 사용한다. 기존 endpoint의 `{ error: string }` 응답은 하위 호환을 위해 그대로 둔다.
- JSON body의 알 수 없는 계산 필드는 무시하지 않고 `INVALID_REQUEST`로 거부한다. 특히 클라이언트 점수·등급을 받는 계약을 만들지 않는다.
- 날짜·시각은 UTC ISO 8601 문자열로 저장한다.

## 4. 회차 endpoint 계약

### 4.1 `POST /api/assessment-rounds`

교사가 4요인 회차와 네 개의 연결 세션을 생성한다. 회차 생성은 하나의 논리 mutation이며, 세션 생성·연결이 일부만 성공한 상태를 외부에 노출하지 않도록 저장소 transaction 또는 보상 삭제를 사용한다.

요청 body:

```ts
interface CreateAssessmentRoundRequest {
  name: string;
  academicYear: number;
  roundType: AssessmentRoundType;
  roundNumber: number;
  classTargets: Array<{ classId: string }>;
  selectedEventsByFactor: SelectedEventsByFactor;
  sessionType: SessionType;
  ruleVersion: string;
  ruleSource: string;
  openImmediately?: boolean;
}
```

- `classTargets`는 한 회차의 대상 반 목록이며 비어 있지 않아야 한다. 대상 학생은 요청 시점의 활성 학생 snapshot이 아니라 조회·확정 시점의 같은 학교 명단을 기준으로 판단한다.
- `sessionType`은 네 연결 세션에 공통 적용한다. 서로 다른 세션 유형을 하나의 4요인 결과에 섞지 않는다.
- 서버는 네 `selectedEventsByFactor`를 검증하고 각 요인에 `PAPSSession` 하나를 만든다. 생성된 세션에는 `assessmentRoundId`와 `factorId` 연결 메타데이터를 저장한다.
- 요청에는 `measurement`, `representativeAttemptId`, `fourFactorSubtotal`, `normalizedScore`, `fourFactorGrade`를 넣지 않는다.

성공 응답 `201`:

```ts
interface CreateAssessmentRoundResponse {
  round: PAPSAssessmentRound;
  sessions: PAPSSession[]; // factorId/assessmentRoundId가 포함된 네 세션
  roundRevision: number;
  requestId: string;
}
```

### 4.2 `GET /api/assessment-rounds/:roundId`

교사 화면의 회차·진행상태·학생별 결과 조회 계약이다.

성공 응답 `200`:

```ts
interface GetAssessmentRoundResponse {
  round: PAPSAssessmentRound;
  sessions: PAPSSession[];
  students: Array<{
    id: string;
    name: string;
    gradeLevel: GradeLevel;
    classId: string;
    classNumber: number | null;
    studentNumber: number | null;
    active: boolean;
  }>;
  results: PAPSStudentRoundResult[];
  roundRevision: number;
  generatedAt: string;
  requestId: string;
}
```

조회 시 서버는 대표 시도와 원측정값을 다시 읽어 `finalized` 결과의 fingerprint가 현재와 다르면 `stale`로 반환한다. 조회는 `ready` snapshot을 저장하지 않는다.

### 4.3 `POST /api/assessment-rounds/:roundId/preview`

최신 대표값으로 학생별 계산을 다시 수행하는 read-like POST이다. 큰 회차의 명시적 계산과 재현 가능한 요청 추적을 위해 POST를 사용하지만, 저장소와 시트를 변경하지 않는다.

요청 body:

```ts
interface PreviewAssessmentRoundRequest {
  studentIds?: string[]; // 생략하면 대상 학생 전체
  expectedRoundRevision?: number;
}
```

성공 응답 `200`:

```ts
interface PreviewAssessmentRoundResponse {
  roundId: string;
  roundRevision: number;
  results: PAPSStudentRoundResult[];
  calculatedAt: string;
  persisted: false;
  requestId: string;
}
```

`expectedRoundRevision`이 현재 회차 revision과 다르면 `409 REVISION_CONFLICT`를 반환한다. preview 응답의 `revision`은 마지막 저장 snapshot revision이며, preview만으로 증가하지 않는다.

### 4.4 `POST /api/assessment-rounds/:roundId/students/:studentId/finalize`

한 학생의 최신 4요인 결과를 서버에서 재계산하고 확정한다.

요청 body:

```ts
interface FinalizeStudentRoundRequest {
  expectedResultRevision: number;
  reason?: string;
}
```

필수 헤더:

- `Idempotency-Key`: 동일한 논리 확정 요청을 재시도할 때 유지한다.
- `If-Match-Revision`: `expectedResultRevision`과 같은 값을 보낸다. 둘이 다르면 `INVALID_REQUEST`다.

처리 순서:

1. 교사 소유권, 회차 상태, 학생 대상 여부를 확인한다.
2. 네 연결 세션의 대표 시도와 원측정값을 저장소에서 다시 읽는다.
3. 네 요인을 모두 검증하고 서버 계산기를 실행한다.
4. 현재 저장된 결과 revision이 `expectedResultRevision`과 다르면 저장하지 않고 `409 REVISION_CONFLICT`를 반환한다.
5. 기존 확정 snapshot과 source fingerprint가 같으면 같은 결과를 반환하는 멱등 replay를 수행한다.
6. 다르면 `revision + 1`의 immutable row를 저장하고 `finalized`로 반환한다.

성공 응답 `201`(새 확정):

```ts
interface FinalizeStudentRoundResponse {
  result: PAPSStudentRoundResult; // status = finalized
  roundRevision: number;
  replayed: false;
  requestId: string;
}
```

동일 idempotency key 또는 동일 source fingerprint의 재시도 성공 응답은 `200`이며 `replayed: true`로 표시한다. 확정 API는 클라이언트가 보낸 점수·등급을 절대 저장하지 않는다.

### 4.5 `POST /api/assessment-rounds/:roundId/finalize-ready`

현재 최신 원자료에서 `ready`인 학생을 일괄 확정한다.

요청 body:

```ts
interface FinalizeReadyRequest {
  studentIds?: string[];
  expectedRoundRevision: number;
  expectedResultRevisions?: Record<string, number>;
}
```

- `studentIds`가 없으면 대상 반의 `ready` 학생 전체를 대상으로 한다.
- `expectedResultRevisions`가 있으면 지정한 각 학생의 revision을 모두 비교한다. 하나라도 충돌하면 전체 mutation을 중단하며 일부 학생만 저장하지 않는다.
- 대상 계산 중 하나라도 `incomplete`, `excluded`, `stale`가 되면 `409 RESULT_NOT_READY`를 반환하고 전체를 저장하지 않는다.

성공 응답 `201` 또는 멱등 replay `200`:

```ts
interface FinalizeReadyResponse {
  results: PAPSStudentRoundResult[];
  finalizedStudentIds: string[];
  roundRevision: number;
  replayed: boolean;
  requestId: string;
}
```

대상 학생이 없으면 `409 NO_READY_RESULTS`다. 일괄 확정의 idempotency key는 전체 요청의 정규화된 학생 ID·revision 목록에 결합한다.

### 4.6 `POST /api/assessment-rounds/:roundId/students/:studentId/exclude`

학생 전체를 해당 회차 측정에서 제외한다. 이 endpoint는 특정 요인을 0점 처리하는 API가 아니다.

요청 body:

```ts
interface ExcludeStudentRequest {
  expectedResultRevision: number;
  reason: string;
}
```

- `reason`은 공백을 제거한 1~500자 필수 문자열이다.
- 성공 시 새 revision을 저장하고 `status: "excluded"`를 반환한다. `factors`의 대표 시도·측정값·요인 점수와 세 합산 필드는 모두 `null`이다.
- 이미 같은 revision·같은 reason으로 처리된 동일 idempotency key는 `200 replayed:true`다.
- 확정된 결과를 제외로 바꿀 때도 이전 `finalized` revision을 삭제하거나 덮어쓰지 않는다.

## 5. HTTP 오류 코드

모든 새 endpoint는 아래 표의 `error.code`와 의미를 따른다.

| HTTP | 코드 | 발생 조건 |
|---:|---|---|
| 400 | `INVALID_JSON` | JSON body를 읽을 수 없음 |
| 400 | `INVALID_REQUEST` | 필수 필드, 타입, 문자열 길이, 헤더가 잘못됨 |
| 400 | `INVALID_FACTOR_SET` | 네 요인 키가 정확히 하나씩 존재하지 않음 |
| 400 | `EVENT_NOT_ELIGIBLE` | 선택 종목이 대상 학년·세션 유형에 부적격 |
| 400 | `INVALID_RULE_VERSION` | 지원하지 않는 규칙 버전 또는 출처 |
| 401 | `UNAUTHENTICATED` | 교사 세션이 없음 또는 만료 |
| 403 | `FORBIDDEN` | 다른 학교의 회차·반·학생에 접근 |
| 404 | `ROUND_NOT_FOUND` | 회차가 없음 |
| 404 | `STUDENT_NOT_FOUND` | 학생이 없음 또는 회차 대상이 아님 |
| 404 | `SESSION_NOT_FOUND` | 연결 세션이 없음 |
| 409 | `ROUND_NOT_EDITABLE` | `archived` 회차 또는 구조 변경이 금지된 상태 |
| 409 | `ROUND_NOT_OPEN` | 개방되지 않은 회차에 측정·확정 시도 |
| 409 | `REVISION_CONFLICT` | 기대 revision과 저장소 현재 revision이 다름 |
| 409 | `RESULT_NOT_READY` | 하나 이상의 요인이 미완료·제외·stale |
| 409 | `RESULT_INCOMPLETE` | 단건 확정 대상의 대표 기록이 하나 이상 없음 |
| 409 | `RESULT_EXCLUDED` | 제외된 학생을 확정하려는 요청 |
| 409 | `STALE_RESULT` | 재계산하지 않은 이전 확정 결과를 확정하려는 요청 |
| 409 | `IDEMPOTENCY_KEY_REUSED` | 같은 key로 다른 payload를 요청 |
| 409 | `NO_READY_RESULTS` | 일괄 확정할 학생이 없음 |
| 409 | `SESSION_ROUND_MISMATCH` | 세션의 회차·요인 연결 메타데이터가 현재 회차와 다름 |
| 503 | `STORAGE_UNAVAILABLE` | 메모리/Google Sheets 저장소를 사용할 수 없음 |

`REVISION_CONFLICT`, `STALE_RESULT`, `RESULT_NOT_READY`에는 현재 revision과 최신 상태를 `details`로 포함해 프론트가 재조회 후 교사에게 선택지를 표시할 수 있게 한다. 오류 message 문자열을 분기 기준으로 사용하지 않는다.

## 6. 멱등성·revision·동시성 계약

### 6.1 revision 정의

- `PAPSAssessmentRound.revision`은 회차의 선택 종목, 대상 반, 연결 세션, 상태 구조가 바뀔 때마다 1씩 증가한다.
- `PAPSStudentRoundResult.revision`은 해당 학생의 영구 snapshot mutation마다 1씩 증가한다. 첫 영구 snapshot은 `1`, 영구 저장 전 상태는 `0`이다.
- `previousRevision`은 새 snapshot이 대체하는 직전 학생 revision이며, 최초 snapshot은 `null`이다.
- `preview`는 revision을 증가시키지 않는다.
- 대표 시도 변경이나 새 시도 저장으로 fingerprint가 달라진 경우, 기존 확정 snapshot을 덮어쓰지 않고 조회 결과를 `stale`로 계산한다. 재확정 때에만 새 revision을 만든다.

### 6.2 멱등 key 저장

- `POST /api/assessment-rounds`와 모든 확정·제외 mutation은 `Idempotency-Key`를 요구한다.
- 저장소는 `(teacherId, route, resourceId, idempotencyKey)`와 정규화된 request hash, 결과 HTTP status, 응답 body, 생성 revision을 함께 보존한다.
- 같은 key와 같은 request hash는 원래 응답을 그대로 반환한다. key를 재사용하면서 payload·대상 학생·expected revision이 달라지면 `IDEMPOTENCY_KEY_REUSED`다.
- key 기록은 해당 회차가 `archived`가 되기 전까지 삭제하지 않는다. archive 이후에도 감사·재시도 검증에 필요한 최소 metadata는 보존하고, 응답 body만 보관 정책에 따라 정리할 수 있다.
- 동시 요청은 저장소 transaction 또는 compare-and-set로 처리한다. revision 비교와 새 snapshot insert가 원자적이지 않으면 안 된다.

### 6.3 저장소 인터페이스 논리 계약

```ts
interface AssessmentRoundStore {
  createAssessmentRound(input: CreateAssessmentRoundRequest & {
    schoolId: string;
    teacherId: string;
    idempotencyKey: string;
  }): Promise<PAPSAssessmentRound>;
  getAssessmentRound(roundId: string): Promise<PAPSAssessmentRound>;
  updateAssessmentRound(input: {
    roundId: string;
    expectedRevision: number;
    status?: AssessmentRoundStatus;
  }): Promise<PAPSAssessmentRound>;
  getStudentRoundResult(input: {
    roundId: string;
    studentId: string;
  }): Promise<PAPSStudentRoundResult | null>;
  saveStudentRoundResult(input: {
    result: PAPSStudentRoundResult;
    expectedRevision: number;
    idempotencyKey: string;
  }): Promise<PAPSStudentRoundResult>;
  listStudentRoundResults(roundId: string): Promise<PAPSStudentRoundResult[]>;
}
```

메모리 저장소와 Google Sheets 저장소는 이 논리 계약을 동일하게 구현한다. Google Sheets가 compare-and-set을 제공하지 않으면 `수정로그` 또는 별도 잠금/상태 버전을 함께 사용해 동일한 효과를 보장하고, 충돌 시 성공처럼 보이는 덮어쓰기를 하지 않는다.

## 7. Google Sheets 저장 계약

### 7.1 템플릿과 탭

- 새 탭 이름은 `4요인회차결과`로 고정한다.
- 기존 `설정`, `학생명단`, `세션기록`, `학생요약`, `공식평가요약`, `오류로그`, `수정로그` 탭과 기존 열은 보존한다.
- 새 템플릿 버전은 `v0.2-four-factor-round`로 올린다. `설정` 탭의 `시트 템플릿 버전` 행 값과 실제 탭·헤더가 모두 일치해야 한다.
- v0.1 시트는 기존 기능의 legacy 시트로 계속 읽을 수 있지만 4요인 회차 API의 저장 대상으로 자동 변환하지 않는다. 사용자가 새 템플릿으로 복사·마이그레이션한 뒤에만 새 탭을 사용한다.
- 탭 검증은 현재 `assertPapsGoogleSheetTabsMatchPrototype`의 순서·헤더 일치 원칙을 유지한다. 구현 시 새 탭을 prototype 목록의 마지막에 추가해 기존 탭의 위치를 바꾸지 않는다.

### 7.2 `4요인회차결과` 헤더와 행 키

헤더는 아래 순서와 문자열을 그대로 사용한다.

```text
회차ID,학생ID,결과Revision,결과상태,회차상태,학년도,회차유형,회차번호,학교ID,학년,반ID,반,번호,학생이름,성별,
심폐지구력_종목ID,심폐지구력_세션ID,심폐지구력_대표시도ID,심폐지구력_원측정값,심폐지구력_요인점수,
유연성_종목ID,유연성_세션ID,유연성_대표시도ID,유연성_원측정값,유연성_요인점수,
근력·근지구력_종목ID,근력·근지구력_세션ID,근력·근지구력_대표시도ID,근력·근지구력_원측정값,근력·근지구력_요인점수,
순발력_종목ID,순발력_세션ID,순발력_대표시도ID,순발력_원측정값,순발력_요인점수,
4요인합계,체지방 제외 환산점수,체지방 제외 4요인등급,규칙버전,규칙출처,원자료Fingerprint,계산시각,확정시각,확정교사ID,이전Revision,저장시각
```

- 실제 header array는 줄바꿈 없이 위 순서를 유지한다.
- 행의 자연키는 `회차ID|학생ID|결과Revision`이다. 동일 자연키를 두 번 append하지 않고 upsert한다.
- `결과상태`는 `incomplete | excluded | ready | finalized | stale`, `회차상태`는 `draft | open | review | finalized | archived`의 영문 enum 값을 저장한다.
- `ready`는 preview-only일 수 있으므로 시트에는 저장하지 않는 것을 기본으로 한다. 저장 adapter가 진행상태를 materialize해야 할 때만 계산시각과 함께 저장하되, 확정시각은 빈 값으로 둔다.
- `incomplete`, `excluded` 행에서 요인별 대표 시도·원측정값·요인점수와 합계·환산점수·등급은 빈 셀이다. `excluded`의 사유는 결과 탭에 개인정보가 섞이지 않도록 `수정로그`의 작업·사유로 남긴다.
- `stale` 행은 감사 목적으로 직전 확정값과 fingerprint를 보존할 수 있지만 현재 결과로 사용하지 않는다. 재확정은 반드시 새 `결과Revision` 행을 만든다.
- 숫자는 Google Sheets number cell, null은 빈 문자열, 시각은 UTC ISO 문자열로 쓴다. 화면용 소수 첫째 자리 문자열을 저장하지 않는다.
- `원자료Fingerprint`는 서버가 계산한 값만 허용한다. 클라이언트가 보낸 fingerprint를 그대로 쓰지 않는다.

### 7.3 기존 시트와의 관계

- `세션기록`은 기존 종목별 시도와 대표값의 원장이다. `4요인회차결과`는 그 원장에서 선택한 네 대표값과 계산 snapshot을 참조하는 파생 결과 탭이다.
- 기존 `학생요약`과 `공식평가요약`은 기존 단일 종목 결과를 유지한다. 4요인 회차 결과를 기존 `공식평가요약`에 합쳐 공식 5요인 결과처럼 보이게 하지 않는다.
- `수정로그`에는 대표값 변경, 회차 확정, 학생 제외, 재확정 작업을 각각 기록한다. 최소 관련 ID는 회차ID·학생ID·결과 revision이다.
- Google Sheets export가 실패하면 결과 확정을 성공으로 응답하지 않는다. local store와 sheet 간 동기화 상태가 필요하면 `pending/failed`를 별도 sync 상태로 보고, `finalized`는 원자적 저장이 확인된 뒤에만 사용한다.

## 8. 기존 session API와의 호환 경계

### 8.1 보존하는 기존 계약

- `PAPSSession`의 기존 필드(`id`, `gradeLevel`, `sessionType`, `classScope`, `eventId`, `classTargets`, `sessionGroupId` 등)는 그대로 유지한다.
- 기존 `POST /api/sessions`, `GET/PATCH /api/sessions/:sessionId`, `POST/PATCH /api/sessions/:sessionId/submit`, `PATCH /api/records/:recordId/representative`의 요청·응답 shape와 기존 오류 문자열은 깨지지 않게 유지한다.
- 학생 측정 제출은 계속 기존 `sessionId`를 대상으로 한다. 제출 route는 4요인 합계·환산점수·등급을 계산하거나 저장하지 않는다.
- 기존 대표값 선택 route가 성공하면 새 회차는 다음 GET/preview에서 fingerprint 변화를 감지하여 필요한 학생 결과를 `stale`로 표시한다. 대표값 route가 회차 결과 탭을 직접 덮어쓰지 않는다.
- 기존 `officialGrade`는 종목별 `PAPSRecordSummary`의 값이며 새 `fourFactorGrade`와 다른 필드·다른 의미다. 두 값을 합치거나 이름을 재사용하지 않는다.

### 8.2 추가하는 선택적 session metadata

4요인 회차에 연결된 session에만 다음 optional metadata를 추가한다.

```ts
interface AssessmentSessionLink {
  assessmentRoundId?: string;
  factorId?: PAPSFourFactorId;
}
```

- legacy session에는 두 필드가 없거나 `undefined`여도 유효하다.
- 둘 중 하나만 존재하거나 `factorId`가 회차의 선택 종목과 불일치하면 새 회차 endpoint에서는 `SESSION_ROUND_MISMATCH`다.
- 기존 다종목 `sessionGroupId`는 과거 임의 종목 묶음으로 계속 지원하되, 같은 group이라는 이유만으로 4요인 회차로 자동 승격하지 않는다. 네 요인·네 연결 session이 모두 명시적으로 생성된 경우에만 새 회차다.
- 기존 세션 수정 route에서 측정 기록이 있는 세션의 구조 변경을 막는 현재 규칙을 유지한다. 연결된 4요인 회차의 `eventId`, 대상 반, factor 연결을 바꾸려면 회차 revision 검사와 별도 회차 편집 계약을 거친다.

### 8.3 프론트 구현 경계

- 기존 결과 화면은 기존 `TeacherResultsViewModel`과 대표값 API를 계속 사용한다. 새 회차 화면은 `PAPSAssessmentRound`와 `PAPSStudentRoundResult`를 별도 view model로 받는다.
- 기존 `recordId`는 `sessionId:studentId` selector 의미를 유지한다. 새 결과의 식별자는 `roundId + studentId + revision`이며 두 ID 체계를 섞지 않는다.
- 기존 세션 화면이 새 회차 결과를 표시할 필요가 있으면 회차 GET/preview를 호출하고, session submit 응답에 점수·등급을 기대하지 않는다.
- 학생 화면은 교사 확정 전 `ready` 점수·등급을 표시하지 않는다. 확정 후에도 해당 학생의 `finalized` 결과만 반환하며 다른 학생 결과 목록을 제공하지 않는다.

## 9. 독립 구현을 위한 최소 검증 목록

- 회차 생성 요청의 요인 키가 정확히 네 개이며 각 요인에 종목 하나만 연결된다.
- 대표값이 없는 요인이 하나라도 있으면 `incomplete`, 세 합산 필드는 `null`, 확정은 `409 RESULT_INCOMPLETE`다.
- 네 요인 점수는 각각 0~20 정수이고 합계는 0~80이다.
- 합계 15/16, 31/32, 47/48, 63/64에서 등급이 각각 5/4, 4/3, 3/2, 2/1로 바뀐다.
- 환산은 항상 `subtotal * 1.25`이며 반올림한 점수로 등급을 다시 계산하지 않는다.
- 대표값 변경 뒤 이전 확정 결과는 `stale`로 보이고, 재확정은 이전 revision을 덮어쓰지 않는다.
- 같은 idempotency key 재시도는 동일 응답을 주고, 다른 payload 재사용은 `IDEMPOTENCY_KEY_REUSED`다.
- 동시 확정 중 하나는 성공하고 다른 하나는 `REVISION_CONFLICT`를 받는다.
- `4요인회차결과` 탭 행 키와 헤더가 고정되며 기존 7개 탭과 기존 session API 데이터가 보존된다.
