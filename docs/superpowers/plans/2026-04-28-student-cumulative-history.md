# 학생 누적 기록 히스토리 1단계 구현 계획

## 배경

학생 세션의 즉시 결과 화면은 지금까지 현재 세션 안에서 입력한 회차만 표시했다. 하지만 PAPS 운영 목표는 한 번의 측정 확인을 넘어, 학생이 1년 동안 같은 종목을 여러 세션에서 측정하며 성장 흐름을 확인하는 것이다.

## 목표

- 학생이 기록을 제출하면 이번 세션의 방금 입력값은 그대로 강조한다.
- 결과 표와 개인 추이 그래프는 같은 학생, 같은 종목, 같은 학년도 기록을 세션을 넘어 누적 표시한다.
- 방금 입력 수정 기능은 현재 세션의 최신 입력 1건만 수정하도록 유지한다.
- 로컬 저장소와 Google Sheets 런타임 모두 같은 응답 구조를 사용한다.

## 1단계 범위

- 제출 API 응답에 `historyAttempts`를 추가한다.
- `historyAttempts`는 `studentId + eventId + academicYear` 기준으로 정렬된 누적 기록이다.
- 각 히스토리 항목에는 기존 `PAPSAttempt` 필드에 더해 세션 이름, 세션 유형, 학년도, 현재 세션 여부를 포함한다.
- 학생 결과 화면의 그래프와 표는 `historyAttempts`가 있으면 이를 우선 사용한다.

## 데이터 계약

```ts
interface PAPSStudentEventHistoryAttempt extends PAPSAttempt {
  sessionId: string;
  sessionName: string;
  sessionType: SessionType;
  eventId: EventId;
  academicYear?: number;
  isCurrentSession: boolean;
}
```

API 응답은 다음 구조를 유지하되 `historyAttempts`만 추가한다.

```ts
{
  student: { id: string; name: string };
  attempts: PAPSAttempt[];
  historyAttempts: PAPSStudentEventHistoryAttempt[];
  latestOfficialGrade: OfficialGrade | null;
}
```

`attempts`는 현재 세션의 방금 입력 수정 기준으로 계속 사용한다. `historyAttempts`는 화면 표시용 누적 흐름으로 사용한다.

## UI 변경

- 카드 상단 설명을 "이번 기록과 누적 기록을 함께 확인"하는 문맥으로 바꾼다.
- 그래프 라벨은 단순 `1회`, `2회`보다 세션 흐름이 보이도록 세션명을 우선 표시한다.
- 표는 누적 기록일 때 `측정`, `세션`, `기록`, `세부 기록` 구조로 보여준다.
- 현재 제출한 최신 기록은 `이번 기록`으로 표시한다.

## 검증 계획

- 로컬 학생 세션 테스트에 이전 세션의 같은 종목 기록을 추가하고, 제출 후 누적 표에 표시되는지 검증한다.
- Google Sheets 제출 테스트에서 응답에 `historyAttempts`가 포함되는지 검증한다.
- 학생 제출 관련 테스트, lint, build를 실행한다.

## 이후 단계

- 교사 결과 화면에서도 학생별 연간 추이 차트를 볼 수 있게 확장한다.
- 종목별 향상률, 공식 평가 대표값, 연습/공식 구분 필터를 추가한다.
- 장기적으로는 학생별 리포트 PDF 또는 이미지 내보내기까지 연결한다.
