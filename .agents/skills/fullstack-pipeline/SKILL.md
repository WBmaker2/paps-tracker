---
name: fullstack-pipeline
description: Next.js 기반 풀스택 웹사이트 작업을 와이어프레임, API 계약, 프론트엔드 구현, 백엔드 구현, QA, 배포 게이트 순서로 조율한다. 풀스택 기능 구현, 페이지 추가, API 연동, 전체 흐름 조율, 하네스 기반 병렬 작업이 필요할 때 사용한다.
---

# Fullstack Pipeline

이 스킬은 이 저장소에서 풀스택 웹사이트 작업을 리더-워커 구조로 조율하는 표준 절차다.

## 목적

- 설계 없이 구현부터 시작하는 실수를 줄인다.
- 프론트엔드와 백엔드의 계약 불일치를 줄인다.
- QA와 배포 게이트를 마지막이 아니라 파이프라인 일부로 고정한다.

## 기본 흐름

1. 요구사항과 완료 조건을 `_workspace/01_product_brief.md`에 정리한다.
2. 디자이너가 `_workspace/02_design_handoff.md`를 만든다.
3. 백엔드가 `_workspace/03_api_contract.md`를 만든다.
4. 프론트와 백엔드를 병렬 구현한다.
5. QA가 `_workspace/05_qa_report.md`를 남긴다.
6. 배포 담당이 `_workspace/06_release_checklist.md`를 남긴다.

## 오케스트레이션

1. `update_plan`으로 작업과 의존성을 기록한다.
2. 디자인 산출물이 없으면 `product-designer`를 먼저 연다.
3. 계약이 없으면 `backend-api-builder`가 먼저 `_workspace/03_api_contract.md`를 만든다.
4. 계약이 생기면 `frontend-nextjs-builder`와 `backend-api-builder`를 병렬로 위임한다.
5. 통합 후 `qa-web-tester`를 호출한다.
6. QA가 통과하면 `release-coordinator`가 배포 메모를 정리한다.

## 워커 위임 템플릿

워커에게는 항상 다음 다섯 가지를 준다.

- 작업 목적
- 책임 범위
- 읽어야 할 경로
- 남겨야 할 `_workspace/` 산출물
- 성공 기준

## `_workspace/` 파일 규칙

- `01_product_brief.md`
- `02_design_handoff.md`
- `03_api_contract.md`
- `04_frontend_handoff.md`
- `04_backend_handoff.md`
- `05_qa_report.md`
- `06_release_checklist.md`
- `06_deploy_notes.md`

## 이 저장소에서 읽을 기본 경로

- 디자인/프론트: `app/`, `src/components/`, `app/globals.css`
- 백엔드/API: `app/api/`, `src/lib/`, `src/data/`
- QA: `tests/`, 배포 URL 또는 로컬 dev server

## 성공 기준

- 화면 구조와 API 계약이 `_workspace/`에 고정되어 있다.
- 프론트와 백엔드 구현 책임이 겹치지 않는다.
- QA 결과와 배포 메모가 남아 있다.
