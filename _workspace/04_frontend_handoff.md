# 프론트엔드 핸드오프: 체지방 제외 4요인 회차

- 작성일: 2026-08-26
- 범위: 교사 회차 생성·결과 확정, 학생 회차 진행·최종 결과
- 상태: UI 구현·백엔드 연결·로컬 품질 검증 완료

## 구현된 화면

- `src/components/teacher/session-form-card.tsx`
  - `종목 기록·연습`과 `4요인 평가 회차` 생성 모드를 분리했습니다.
  - 4요인 모드에서는 네 요인별 종목을 정확히 하나씩 선택하고 `POST /api/assessment-rounds`를 호출합니다.
  - `Idempotency-Key`, `sessionType: official`, 기본 `roundType: regular`, `roundNumber: 1`, `openImmediately`를 보냅니다.
  - 서버 단일 진실원인 `ruleVersion/ruleSource`, 교사·학교 식별자는 클라이언트 body에 넣지 않습니다.
  - split 대상 학년에서는 두 반의 적격 종목 교집합만 표시합니다.

- `src/components/teacher/four-factor-round-result-panel.tsx`
  - 학생×4요인 완료 상태와 대표 기록·요인점수·합계·환산점수·등급을 표시합니다.
  - `ready` 단건 확정, 준비 학생 일괄 확정, `stale` 재확정, 로딩·빈 상태·오류 메시지를 제공합니다.
  - canonical `studentSnapshot`/`eventId` 응답은 `four-factor-round-adapter.ts`에서 이름·종목명·단위가 포함된 로컬 `FourFactorStudentResultView`로 변환합니다. 단건·일괄 확정 직후에도 같은 adapter를 거칩니다.

- `src/components/student/four-factor-progress-card.tsx`
  - `0/4`~`4/4` 진행 카드, 다음 미측정 종목, 교사 확정 후 결과를 표시합니다.
  - finalized 결과의 `factors`가 배열 또는 factorId 키드 레코드인 두 submit payload를 모두 정규화하여 네 대표 기록(측정값·단위·요인점수/20)을 표시합니다.
  - 최종 안내에 `공식 PAPS 종합등급이 아닌 체지방 제외 4요인 환산 결과` 경계를 고정했습니다.

- `src/components/student/split-session-view.tsx`, `session-group-view.tsx`
  - 제출 응답의 선택적 `roundProgress`·`finalizedResult`를 표시합니다.
  - 회차 모드에서는 타 세션 누적 이력을 표시하지 않습니다.
  - 다음 미측정 종목 액션이 해당 factor의 열려 있는 세션으로 실제 전환됩니다.
  - 다른 학생을 선택하면 lifted 진행/확정 결과를 초기화하고, 같은 학생이 다음 factor 세션으로 이동할 때는 진행을 유지합니다.

## 백엔드 연결 지점

`src/components/four-factor-round-types.ts`는 API/store 타입과 일부러 분리한 UI 계약입니다. 서버 응답 adapter에서 다음 필드를 매핑하면 됩니다.

- `GET /api/assessment-rounds/:roundId` → `FourFactorRoundResultPanel`의 `results`, `roundRevision`
- `POST /api/assessment-rounds/:roundId/students/:studentId/finalize` → `result`
- `POST /api/assessment-rounds/:roundId/finalize-ready` → `results`
- 기존 학생 submit 응답의 선택 필드 → `roundProgress`, `finalizedResult`
- 학생 그룹 조회의 `assessmentRound` 또는 `assessment` metadata → `SessionGroupView.assessmentProgress`

서버가 정한 `ruleVersion/ruleSource`, 교사·학교 소유권, 점수·등급 계산은 프론트에서 생성하거나 재계산하지 않습니다.

## 접근성·반응형

- 주요 상태 메시지에 `aria-live`, 확정 중 버튼에 `aria-busy`를 적용했습니다.
- 390px 폭에서 요인 카드가 한 열로 쌓이고 버튼이 전체 너비로 확장됩니다.
- `gi-pulse`는 다음 미측정 종목·확정 행동을 강조하며 `prefers-reduced-motion: reduce`에서는 정적 테두리로 대체됩니다.
