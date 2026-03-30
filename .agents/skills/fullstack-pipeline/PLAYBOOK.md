# 풀스택 파이프라인 플레이북

이 문서는 `fullstack-tech-lead`가 실제 세션에서 워커를 어떻게 조율할지 보여주는 실전용 메모다.

## 1. 시작 순서

1. 요구사항을 `_workspace/01_product_brief.md`에 정리한다.
2. `update_plan`으로 단계와 의존성을 적는다.
3. 디자인 핸드오프가 없으면 `product-designer`를 먼저 호출한다.
4. API 계약이 없으면 `backend-api-builder`에게 계약 정리를 먼저 맡긴다.
5. 계약이 생기면 프론트와 백엔드를 병렬로 연다.
6. 통합 후 QA를 돌리고, 마지막에 배포 체크를 붙인다.

## 2. 권장 위임 순서

### 디자인

- 대상 에이전트: `product-designer`
- 산출물: `_workspace/02_design_handoff.md`

프롬프트 뼈대:

```text
목적: 새 기능의 와이어프레임 수준 화면 흐름과 상태를 정리해줘.
책임 범위: 화면 구조, 상태, 액션, 문구, 구현 메모.
읽을 경로: app/, src/components/, 관련 docs/.
남길 산출물: _workspace/02_design_handoff.md
성공 기준: 프론트엔드가 바로 구현 가능한 수준의 handoff가 남아 있음.
```

### 백엔드 계약

- 대상 에이전트: `backend-api-builder`
- 산출물: `_workspace/03_api_contract.md`

```text
목적: 프론트가 의존할 요청/응답 계약과 검증 규칙을 정리해줘.
책임 범위: API shape, validation, persistence, failure responses.
읽을 경로: app/api/, src/lib/, src/data/, _workspace/02_design_handoff.md
남길 산출물: _workspace/03_api_contract.md
성공 기준: 프론트가 mock 없이 연결 가능한 계약 문서가 있음.
```

### 프론트 구현

- 대상 에이전트: `frontend-nextjs-builder`
- 산출물: `_workspace/04_frontend_handoff.md`

### 백엔드 구현

- 대상 에이전트: `backend-api-builder`
- 산출물: `_workspace/04_backend_handoff.md`

프론트와 백엔드는 계약이 고정된 뒤 병렬로 위임한다.

## 3. QA 호출 시점

다음 세 조건을 만족할 때 `qa-web-tester`를 호출한다.

- 프론트 구현 완료
- 백엔드 구현 완료
- 최소한의 연결 스모크가 가능함

QA 산출물:

- `_workspace/05_qa_report.md`

## 4. 배포 게이트

QA가 통과하면 `release-coordinator`가 다음 두 파일을 남긴다.

- `_workspace/06_release_checklist.md`
- `_workspace/06_deploy_notes.md`

## 5. 리더 체크리스트

- [ ] 디자인 핸드오프가 존재하는가
- [ ] API 계약이 존재하는가
- [ ] 프론트/백엔드 책임 경계가 겹치지 않는가
- [ ] QA 재현 절차가 남았는가
- [ ] 배포 메모가 운영자가 읽을 수 있는 수준인가
