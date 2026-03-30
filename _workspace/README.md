# `_workspace` 사용 규칙

이 디렉토리는 하네스의 중간 산출물과 핸드오프 파일을 저장한다.

## 목적

- 워커 간 전달을 채팅 기억에만 의존하지 않게 한다.
- 설계, 계약, QA 근거를 파일로 남긴다.
- 다음 세션에서도 동일한 흐름을 재사용할 수 있게 한다.

## 권장 파일

- `01_product_brief.md`
- `01_wireframe_brief.md`
- `02_design_handoff.md`
- `03_api_contract.md`
- `03_frontend_plan.md`
- `03_backend_plan.md`
- `04_frontend_handoff.md`
- `04_backend_handoff.md`
- `05_qa_report.md`
- `06_release_checklist.md`
- `06_deploy_notes.md`

## 작성 원칙

- 긴 판단과 구조화된 결과는 채팅보다 파일로 남긴다.
- 최신 판단을 덮어쓸 때는 이전 내용을 완전히 지우기보다 변경 이유를 남긴다.
- 워커는 자신이 맡은 파일만 직접 수정하고, 리더가 최종 통합을 담당한다.

## 템플릿

`_workspace/templates/` 아래 템플릿을 복사해 시작하면 된다.
