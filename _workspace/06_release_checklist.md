# 릴리스 체크리스트: v1.2.3

## 로컬 릴리스 게이트 — 2026-09-29

- [x] `package.json`의 `sharp` override를 수정 버전 `0.35.4`로 변경
- [x] `package-lock.json`에 `sharp@0.35.4`와 플랫폼별 optional 패키지 반영
- [x] 운영 의존성 감사 통과 — 운영 취약점 0건
- [x] Node 22/npm 10에서 `npm ci --no-audit --no-fund` clean install 통과
- [x] CI 테스트 통과 — `npm run test:ci`, 85개 파일·345개 테스트
- [x] 린트 통과 — `npm run lint`
- [x] 타입 검사 통과 — `npm run typecheck`
- [x] 프로덕션 빌드 통과 — `npm run build`
- [x] 공백·충돌 표식 검사 통과 — `git diff --check`
- [x] Node `v22.23.3`, npm `10.9.9`에서 clean install·감사·전체 테스트·린트·타입 검사·빌드 재확인
- [ ] 변경 검토 및 커밋
- [ ] 추적 브랜치 푸시
- [ ] GitHub Actions / Production 배포 결과 확인
- [ ] 배포 URL, 버전, `/api/health`, 비로그인 접근 경계, 모바일 화면 검증

## 데이터·연동 상태

- 기존 운영 측정 데이터와 Google Sheets를 수정·삭제하지 않았습니다.
- 로컬 민감 키 인증 오류와 Drive 메타데이터 403으로 독립 QA 시트의 실연동 사전 읽기가 불가능했습니다. 쓰기 0건입니다.
- Google Sheets 연동, 인증된 교사 화면, 배포 후 동작은 이번 로컬 게이트에서 검증하지 않았습니다.
- 보안 및 로컬 품질 게이트는 통과했습니다. 변경 검토 후 커밋·푸시·배포를 진행할 수 있습니다.

## 런타임 메모

- GitHub advisory [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)의 `sharp@0.35.4`를 lockfile과 clean install에서 확인했습니다.
- 빌드 중 오래된 Browserslist 데이터 안내가 출력됐지만 빌드는 성공했습니다.
