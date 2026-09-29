# 릴리스 체크리스트: v1.2.6 세션 설정 행 복구 준비

## 로컬 게이트 — 2026-09-29

- [x] 설정 탭 저장 후 실제 행 재조회 및 저장 payload 비교
- [x] 삭제·축소 시 Sheets의 trailing 빈 행 생략을 허용하고 필수 행 손실은 차단
- [x] 재조회 검증은 설정 탭으로 한정하고 학생 명단 저장은 기존 읽기 횟수 유지
- [x] 격리 recovery planner가 복구 대상 상태, 온전한 같은 묶음 세션, 매니페스트의 공통값과 group item 순서를 확인
- [x] 실제 검토용 매니페스트에서 정확히 8개 행 생성 — 악력 3행, 제자리멀리뛰기 5행
- [x] 기본 preview, 고정 운영 시트 ID·묶음 확인, 설정 전용 백업(0600·gitignore), 재확인·재조회 구현
- [x] 운영 측정 기록 탭 무쓰기 원칙 확인
- [x] `npm run test:ci` 통과 — 86개 파일·358개 테스트
- [x] `npm run typecheck`, `npm run lint`, `npm run audit:prod` 통과 — 운영 취약점 0건
- [x] `NEXTAUTH_SECRET=local-build-placeholder npm run build` 통과
- [x] `git diff --check` 통과
- [ ] 이번 범위 파일만 앱 커밋·브랜치 푸시
- [ ] Vercel Production 배포 및 READY 확인
- [ ] Production URL 및 deployment 식별 기록
- [ ] 별도 승인된 운영 시트 복구 단계에서만 8행 반영 및 데이터 재조회

### 매니페스트

- 파일: `work/september-session-recovery-manifest.json`
- 복구할 항목: 악력 `2e4124e3-a6b1-4cd1-b53a-dccdf4a0072d`, 제자리멀리뛰기 `e594181b-1632-4c2f-bfe3-1033f5b3b392`
- 이름 근거: 제자리멀리뛰기 세션 이름은 원래 설정 행이 없어 제안된 추론값이며, 적용 전 교사가 확인해야 합니다.
- 배포 전 현재 Production: [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app), deployment `dpl_D77vMsvjcziazKSBVQRZW6BxPYXe`, `READY`
- 최신 읽기 전용 시트 상태: 설정 sheetId=0, grid 992행·값 200행, A201:F208 비어 있음; 세션기록 318개 데이터 행, 대상 ID 기록 0건

---

# 릴리스 체크리스트: v1.2.5

## v1.2.5 — 교사 세션 생성에서 4요인 회차 제거 (2026-09-29)

- [x] 교사 세션 생성 폼의 4요인 평가 회차 항목, 전용 입력 UI, 전용 제출 분기 제거
- [x] 기존 회차 결과/API/Google Sheets 관련 코드 보존
- [x] Node.js 22에서 `npm run test:ci` 통과 — 85개 파일·349개 테스트
- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run audit:prod` 통과
- [x] `git diff --check` 통과
- [x] 운영 Google Sheets 쓰기 및 기존 기록 변경 없음
- [x] 롤백 지점: 배포 직전 Production 배포 이력
- [x] 앱 커밋·현재 브랜치 푸시 — `a1994deda215d7cc4a8a2a708cb14fabd2a70b82`
- [x] Vercel Production 배포 및 READY 확인 — `dpl_GzYPGeDbPzXPNzGVMvFktwqoUChS`
- [x] Ego Browser 로그인 교사 화면 읽기 전용 확인 — `/teacher` 세션 생성에 `4요인 평가 회차`·`생성 모드`가 없고 `세션 저장`이 있음; 업데이트 내역 `v1.2.5` 표시
- [x] 확인 당시 수정 버튼 6개·삭제 버튼 6개 관찰 (직전 v1.2.4 화면 확인은 각각 8개; 원인은 추정하지 않음)
- [x] 세션 저장·수정·삭제 및 Google Sheets 쓰기 없이 읽기 전용으로 확인

### 배포 후 확인

- 배포 주소: [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app)
- Vercel deployment ID/상태: `dpl_GzYPGeDbPzXPNzGVMvFktwqoUChS` / `READY`
- 배포 빌드 URL: [https://paps-tracker-fv9j062wh-wbmaker2s-projects.vercel.app](https://paps-tracker-fv9j062wh-wbmaker2s-projects.vercel.app)
- 앱 커밋 SHA: `a1994deda215d7cc4a8a2a708cb14fabd2a70b82`
- 실제 Sheets 쓰기: 0건
- 앱 배포 URL 직접 fetch/curl 확인은 Vercel deploy skill 지침상 수행하지 않음
- QA/체크리스트 후속 문서 커밋은 앱을 변경하지 않으며 재배포하지 않음

## 로컬 릴리스 게이트 — 2026-09-29

- [x] 전체 테스트 종료 원인 수정: `SessionStatusList` 기본 보관 세션 배열을 안정 상수로 지정
- [x] Node.js 22에서 `npm run test:ci` 종료 코드 0 — 85개 파일·349개 테스트
- [x] `npm run lint` 통과
- [x] `npm run typecheck` 통과
- [x] `npm run build` 통과
- [x] `npm run audit:prod` 통과
- [x] `git diff --check` 통과
- [x] `package.json` 및 `package-lock.json` 버전 `1.2.4` 일치
- [x] 기존 측정 기록 보존 경계 검토: 운영 Google Sheets 쓰기 0건, 학생 측정 기록 변경 0건
- [x] 롤백 지점: 배포 대상 커밋 직전 Production 배포 이력
- [x] 지정 파일 커밋 및 현재 브랜치 푸시 — 앱 SHA `2452faddd3c46193a756d55c8145d4bc30d3d665`
- [x] Vercel Production 배포 완료 — `dpl_E8gEKFD6WUADsVWXxfj69JuzNyeA`, `READY`
- [x] Production alias 확인 — [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app)
- [x] 로그인된 교사 화면을 읽기 전용 확인 — 업데이트 내역 v1.2.4, 삭제 버튼 8개, 중복 종목 수정 안내 확인; 저장·삭제 실행 안 함
- [x] 실제 데이터 보호 — Google Sheets 쓰기 0건, 학생 측정 데이터 변경 0건

## 배포 후 확인

- 배포 주소: [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app)
- Vercel deployment: `dpl_E8gEKFD6WUADsVWXxfj69JuzNyeA` (`READY`)
- 배포 앱 커밋 SHA: `2452faddd3c46193a756d55c8145d4bc30d3d665`
- 후속 문서 커밋은 QA 보고서·체크리스트만 변경합니다. 문서 커밋은 배포된 앱 커밋과 별도이며 앱 재배포는 하지 않습니다.
- 공개 경로 확인: Vercel 배포 skill 지침에 따라 URL을 제공하고 직접 fetch/curl 확인은 하지 않음

---

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
