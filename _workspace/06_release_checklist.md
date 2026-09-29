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
- [x] 변경 검토 및 앱 커밋 `54da59b1eedc45bb081619f31d618db75f94494c`
- [x] 추적 브랜치 푸시
- [x] GitHub Actions run `36519492546` 성공 및 Production 배포 `dpl_9YUpLzAvroN6RPXv4GYgQpifHjsQ` `READY`
- [x] `https://paps-tracker.vercel.app` HTTP 200, `v1.2.3`, `/api/health` `ready: true`, 비로그인 교사 경로의 로그인 이동 확인
- [x] Ego Browser의 로그인된 교사 홈·설정·학생 명단·결과 화면 확인; 320·375·768·1280px에서 문서 가로 넘침 없음, 업데이트 내역 `v1.2.3`
- [ ] 연결된 학교 시트의 실제 기록·그래프·동시 작업 확인 — 현재 로그인 계정에 시트 연결이 없음

## 데이터·연동 상태

- 기존 운영 측정 데이터와 Google Sheets를 수정·삭제하지 않았습니다.
- 로컬 민감 키 인증 오류와 Drive 메타데이터 403으로 독립 QA 시트의 실연동 사전 읽기가 불가능했습니다. 쓰기 0건입니다.
- 공개 HTTP 경로와 비로그인 접근 경계, 로그인된 교사 화면의 미연결 상태를 배포 후 확인했습니다. Production Google Sheets 동시 작업은 현재 시트 연결이 없어 검증하지 않았습니다.
- 보안·로컬·GitHub CI 게이트는 통과했고 Production 배포는 완료됐습니다.

## 런타임 메모

- GitHub advisory [GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c)의 `sharp@0.35.4`를 lockfile과 clean install에서 확인했습니다.
- 빌드 중 오래된 Browserslist 데이터 안내가 출력됐지만 빌드는 성공했습니다.
