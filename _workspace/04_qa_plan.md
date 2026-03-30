# QA 계획

## 기능명

- 교사 결과 화면 필터 및 검색 패널

## 목적

- 필터/검색 기능이 추가되어도 결과 검토 핵심 흐름인 `대표값 선택`, `요약 재계산`, `요약 다운로드`가 깨지지 않는지 검증한다.
- 새 기능이 단순 렌더링 수준이 아니라, `서버 집계 데이터 -> 클라이언트 필터 state -> 오른쪽 보조 패널 -> 기존 mutation API` 경계면 전체에서 일관되게 동작하는지 확인한다.

## QA 범위

### 포함

- 결과 화면 서버 집계 데이터 준비
- 필터 UI 렌더링과 상호작용
- 포커스 row 유지 규칙
- 대표값 선택과 필터 state 공존
- 오른쪽 그래프/동기화 카드의 반응
- 요약 미리보기 안내 문구와 다운로드 링크 유지

### 제외

- Google Sheets 탭 구조 자체 변경 검증
- 학생 입력 화면
- 로그인 provider 자체 검증

## QA 전략

이번 기능은 세 층으로 검증한다.

1. `View model / helper` 검증
2. `Client workspace / component interaction` 검증
3. `Page rendering + 브라우저 스모크` 검증

이렇게 나누면 어떤 레이어에서 문제가 생겼는지 분리하기 쉽다.

## 1. 단위 / helper 검증

### 새 테스트 후보

- [tests/lib/teacher-results-view-model.test.ts](/Volumes/DATA/Dev/Codex/paps-tracker/tests/lib/teacher-results-view-model.test.ts)

### 검증 항목

- 여러 세션을 합쳐도 row 집계가 올바르다
- `gradeLevel`, `classId`, `eventId`, `sessionType`이 row에 채워진다
- filter options가 중복 없이 생성된다
- `initialFocusRecordId`가 정렬 규칙에 맞게 계산된다
- `studentNameNormalized` 검색용 값이 일관되게 생성된다

### 실패 기준

- 필터가 기대하는 메타데이터 필드가 하나라도 빠짐
- 정렬/포커스 규칙이 테스트와 다름

## 2. 컴포넌트 상호작용 검증

### 새 테스트 후보

- [tests/app/teacher-results-workspace.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-workspace.test.tsx)

### 검증 항목

#### 검색

- 학생 이름 일부 입력 시 결과가 좁혀진다
- 검색어 제거 시 전체 목록이 복구된다

#### 학년/반 연동

- 학년 선택 시 반 옵션이 해당 학년만 남는다
- 이미 선택한 반이 무효가 되면 자동 초기화된다

#### 세션 유형 / 종목 필터

- `공식` 선택 시 공식 row만 남는다
- `연습` 선택 시 연습 row만 남는다
- 종목 필터가 eventId 기준으로 정확히 동작한다

#### 빈 결과 상태

- 결과가 0건이면 빈 상태 카드가 보인다
- `필터 초기화` 버튼이 보인다
- `필터 초기화` 후 목록이 복구된다

#### 포커스 규칙

- 현재 포커스 row가 filtered rows에 남아 있으면 유지된다
- 제외되면 첫 번째 filtered row로 바뀐다
- filtered rows가 0건이면 포커스는 null 처리된다

### 실패 기준

- 필터 state 변경 후 목록/포커스가 어긋남
- 반 옵션 무효화 규칙이 동작하지 않음
- 빈 상태에서 복구 액션이 없음

## 3. 기존 컴포넌트 회귀 검증

### 기존 테스트 보강 대상

- [tests/app/teacher-results-page.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-results-page.test.tsx)
- [tests/app/teacher-rebuild.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-rebuild.test.tsx)
- [tests/app/teacher-representative.test.tsx](/Volumes/DATA/Dev/Codex/paps-tracker/tests/app/teacher-representative.test.tsx)

### 검증 항목

- `검색 및 필터` 카드가 새로 보인다
- `학생요약 미리보기`, `공식평가요약 미리보기`, `요약 XLSX 다운로드`는 계속 보인다
- `이 요약표는 현재 화면 필터와 별개로 전체 연결 시트 기준입니다.` 문구가 보인다
- 대표값 선택 API 호출 흐름이 여전히 정상이다
- `요약 재계산` 버튼이 여전히 정상이다

### 실패 기준

- 기존 대표값/재계산/다운로드 기능 중 하나라도 사라짐
- 문구/헤딩 회귀로 기존 테스트가 깨짐

## 4. 브라우저 스모크 검증

### 대상 경로

- `/teacher/results`

### 준비 조건

- 교사 로그인 가능한 상태
- 결과 row가 2개 이상, 가능하면 서로 다른 세션 유형/학급/종목 데이터가 준비된 상태

### 시나리오

1. 결과 화면 진입
2. 필터 카드 확인
3. 학생명 검색으로 목록 좁히기
4. 학년/반 필터 조합 확인
5. `공식` / `연습` 전환 확인
6. 빈 결과 상태 만들기
7. `필터 초기화`로 복구
8. 필터 적용 상태에서 대표값 선택
9. 오른쪽 그래프/동기화 카드가 현재 포커스 row 기준으로 갱신되는지 확인
10. 요약 카드의 안내 문구와 다운로드 링크 확인

### 증거

- 필요 시 스크린샷
- 재현 절차
- 실패 시 콘솔/화면 메시지

## 5. 회귀 명령 계획

### 우선 실행

- 기능 관련 테스트만 먼저 실행

예상 명령:

```bash
npm test -- \
  tests/lib/teacher-results-view-model.test.ts \
  tests/app/teacher-results-workspace.test.tsx \
  tests/app/teacher-results-page.test.tsx \
  tests/app/teacher-representative.test.tsx \
  tests/app/teacher-rebuild.test.tsx
```

### 최종 게이트

```bash
npm test
npm run lint
npm run build
```

## 6. blocker 기준

다음은 `중요 버그`로 보고 수정 전 배포하지 않는다.

- 필터 결과와 실제 대표값 대상 row가 다름
- 대표값 선택 후 목록 상태가 깨짐
- 빈 결과 상태에서 복구 불가
- 공식/연습 필터가 잘못된 row를 보여줌
- 오른쪽 그래프/동기화 카드가 다른 학생 기준으로 남아 있음
- `요약 XLSX 다운로드` 또는 `요약 재계산` 회귀

## 7. QA 보고서 산출물

이 계획 실행 후 실제 결과는 아래 파일에 정리한다.

- [_workspace/05_qa_report.md](/Volumes/DATA/Dev/Codex/paps-tracker/_workspace/templates/05_qa_report.md)

보고서에는 반드시 아래를 남긴다.

- 실행한 명령
- 통과/실패 여부
- 재현 절차
- 남은 위험
- 배포 가능 여부

## 8. 릴리스 게이트 연결

QA가 통과하면 다음 문서로 넘긴다.

- [_workspace/06_release_checklist.md](/Volumes/DATA/Dev/Codex/paps-tracker/_workspace/templates/06_release_checklist.md)
- [_workspace/06_deploy_notes.md](/Volumes/DATA/Dev/Codex/paps-tracker/_workspace/templates/06_deploy_notes.md)

## QA 성공 기준

- 새 필터/검색 기능이 의도대로 동작한다.
- 기존 결과 검토 핵심 흐름이 모두 유지된다.
- 테스트, 린트, 빌드 게이트가 통과한다.
- 브라우저 스모크에서 교사가 실제로 사용할 수 있는 수준으로 확인된다.
