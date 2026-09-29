# v1.2.3 커밋·푸시·배포 계획

## 범위와 보존 대상

- 현재 `codex/student-growth-ui-improvements` 브랜치의 학생·교사 UX, Google Sheets 기록 보존, 중복 제출 방지, 빈 XLSX 템플릿, PAPS 계산·표시 개선을 한 릴리스로 묶습니다.
- 기존 측정 기록과 운영 Google Sheets는 수정·삭제하지 않습니다. 배포 후 검증도 읽기 전용 경로로 제한합니다.
- 기존 개인 파일 `PROJECT_CONTEXT.md`, `output/playwright/`, 비공개 감사 증거 `work/`의 다른 파일과 `.env.local`은 커밋하지 않습니다. 이 계획 문서와 공개 가능한 QA·릴리스 문서만 선택하여 포함합니다.

## 순서

1. 변경 목록, 민감 정보, 500줄 이상 코드 파일, 버전·업데이트 내역을 검토합니다.
2. Node 22 환경을 우선 사용하여 `npm run audit:prod`, `npm run test:ci`, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`를 실행합니다. Node 22가 없으면 사용한 런타임을 명시합니다.
3. `_workspace/05_qa_report.md`와 `_workspace/06_release_checklist.md`에 이번 버전의 증거와 미검증 사항을 기록합니다.
4. Luna 에이전트가 앱 변경과 릴리스 문서만 선택하여 커밋하고 현재 추적 브랜치에 푸시합니다.
5. GitHub Actions 결과를 확인하고 연결된 Vercel Production 배포를 확인합니다. 자동 배포가 없으면 연결된 프로젝트에 Production 배포를 실행합니다.
6. 실제 배포 URL에서 버전·업데이트 내역·`/api/health`·비로그인 접근 경계·모바일 화면을 확인합니다. 인증된 교사 화면은 기존 브라우저 세션으로 읽기 전용 확인이 가능할 때만 검증합니다.

## 실패·롤백

- 배포 전 기준 커밋은 `c63c06c`입니다. 빌드 또는 운영 검증 실패 시 원인을 기록하고 이전 Production 배포로 롤백합니다.
- 운영 환경변수 값은 출력하거나 변경하지 않습니다. 로컬에서 민감 값이 가려져 실제 Sheets 연동 재검증이 불가능하면 그 한계를 정확히 보고합니다.
- 동일한 배포 시도가 세 번 실패하면 추가 반복을 멈추고 사용자와 진행 방향을 협의합니다.
