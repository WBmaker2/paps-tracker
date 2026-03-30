# 풀스택 웹사이트 개발 하네스 설계

## 목표

이 하네스는 `Next.js + React + Route Handlers/API + 테스트` 구조를 가진 저장소에서
와이어프레임부터 배포 직전 QA까지를 한 팀처럼 조율하기 위한 Codex 네이티브 작업 체계다.

핵심 목표는 다음과 같다.

- 디자인, 프론트엔드, 백엔드, QA의 책임을 분리한다.
- 리더가 전체 범위를 통제하고, 독립 작업은 병렬 워커에 위임한다.
- 중간 산출물을 `_workspace/`에 파일로 남겨 다음 단계 입력으로 재사용한다.
- 구현보다 앞서 계약과 핸드오프를 먼저 고정해 재작업을 줄인다.

## 권장 아키텍처

- 패턴: `리더-워커 팬아웃 + 단계형 파이프라인 + QA 리뷰 루프`
- 리더: `fullstack-tech-lead`
- 워커:
  - `product-designer`
  - `frontend-nextjs-builder`
  - `backend-api-builder`
  - `qa-web-tester`
  - `release-coordinator`

이 저장소는 이미 `app/`, `src/components/`, `app/api/`, `tests/`로 경계가 나뉘어 있으므로,
프론트와 백엔드를 병렬로 나누고 QA를 별도 역할로 두는 것이 가장 자연스럽다.

## 파이프라인

### 1. 문제 정의와 와이어프레임

- 리더가 요구사항, 제약, 완료 조건을 정리한다.
- 디자이너가 화면 흐름, 핵심 상태, 와이어프레임 수준의 구조를 만든다.
- 산출물:
  - `_workspace/01_product_brief.md`
  - `_workspace/01_wireframe_brief.md`
  - `_workspace/02_design_handoff.md`

### 2. 계약 고정

- 리더가 디자인 산출물을 기준으로 API 계약과 데이터 흐름을 고정한다.
- 백엔드 워커가 요청/응답 shape, 검증 규칙, 저장 경로를 정리한다.
- 프론트 워커는 필요한 컴포넌트 경계와 상태 흐름을 정리한다.
- 산출물:
  - `_workspace/03_api_contract.md`
  - `_workspace/03_frontend_plan.md`
  - `_workspace/03_backend_plan.md`

### 3. 병렬 구현

- 프론트 워커는 `app/`, `src/components/` 중심으로 구현한다.
- 백엔드 워커는 `app/api/`, `src/lib/`, `src/data/` 중심으로 구현한다.
- 리더는 범위 변경과 충돌만 조정한다.
- 산출물:
  - `_workspace/04_frontend_handoff.md`
  - `_workspace/04_backend_handoff.md`

### 4. 통합과 QA

- QA 워커가 실제 경계면을 검증한다.
- 비교 대상:
  - 디자인 핸드오프 vs 실제 UI
  - API 계약 vs 프론트 기대 shape
  - 저장 전/후 상태
  - 성공 경로/실패 경로
- 산출물:
  - `_workspace/05_qa_report.md`

### 5. 배포 게이트

- 린트, 테스트, 빌드, 브라우저 스모크를 확인한다.
- 배포 워커가 환경변수, 배포 방식, 롤백 포인트를 점검한다.
- 산출물:
  - `_workspace/06_release_checklist.md`
  - `_workspace/06_deploy_notes.md`

## 역할 정의

### fullstack-tech-lead

- 범위 확정
- 워커 분할과 파일 책임 정의
- `_workspace/` 산출물 통합
- 위험과 blocker 관리

### product-designer

- 사용자 흐름
- 화면 구조
- 상태 정의
- 디자인 핸드오프 문서 작성

### frontend-nextjs-builder

- App Router 페이지/레이아웃/컴포넌트 구현
- 디자인 핸드오프를 실제 UI로 번역
- 접근성/상태/폼 흐름 구현

### backend-api-builder

- API 계약 설계
- 검증, 저장, 오류 처리
- 프론트가 기대하는 shape 안정화

### qa-web-tester

- 테스트 명령 실행
- 브라우저 스모크
- 회귀 위험 및 재현 절차 문서화

### release-coordinator

- 배포 전 체크리스트
- 환경변수/배포 메모
- 릴리스 노트 정리

## `_workspace/` 규칙

- 파일명은 `{phase}_{artifact}.md` 형식을 우선한다.
- 설계/계약/QA 결과는 반드시 파일로 남긴다.
- 긴 산출물은 채팅 메시지 대신 `_workspace/` 파일로 전달한다.
- 최신 판단은 리더가 통합해서 하나의 다음 단계 입력으로 정리한다.

## 리더 오케스트레이션 규칙

1. `update_plan`으로 작업과 의존성을 관리한다.
2. 디자인과 계약 정리 후에만 구현 워커를 연다.
3. 프론트와 백엔드는 계약 문서가 나온 뒤 병렬로 위임한다.
4. QA는 구현 후 한 번만 돌리지 않고, 주요 통합 시점마다 점진적으로 수행한다.
5. 결과가 필요할 때만 `wait_agent`를 호출한다.
6. 더 이상 필요 없는 워커는 `close_agent`로 정리한다.

## 완료 조건

- `agents/`만 읽어도 팀 역할이 이해된다.
- `.agents/skills/`에서 팀 운영 절차를 바로 재사용할 수 있다.
- `_workspace/` 템플릿이 있어 핸드오프 형식이 흔들리지 않는다.
- 리더가 와이어프레임부터 QA/배포까지 한 흐름으로 조율할 수 있다.
