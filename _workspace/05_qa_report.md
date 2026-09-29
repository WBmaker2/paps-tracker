# QA 보고서: v1.2.5 교사 세션 생성의 4요인 회차 항목 제거

## v1.2.5 교사 세션 생성 항목 정리 (2026-09-29)

- 요청: 교사 세션 생성 화면의 `4요인 평가 회차` 항목과 이에만 필요한 생성 UI 및 제출 분기를 제거했습니다.
- 재현 절차: 교사 홈에서 세션 생성 폼을 열어 종목 세션 흐름을 확인합니다. 4요인 회차 생성 선택/입력 UI와 해당 생성 제출 분기가 코드에서 제거됐습니다.
- 회귀 범위: 기존 생성된 회차의 결과 조회, 학생 진행, API 및 Google Sheets 저장 코드는 유지했습니다. 기존 운영 시트에 쓰거나 기록을 변경하지 않았습니다.
- 검증 환경: Node.js 22 `/private/tmp/paps-release-runtime/node_modules/node/bin/node`.
- 실행 명령과 결과: `npm run test:ci` 통과 (85개 파일·349개 테스트), `npm run lint`, `npm run typecheck`, `npm run build`, `npm run audit:prod` (운영 취약점 0건), `git diff --check` 모두 통과.
- 수정 필요 여부: 없음. 제거한 생성 전용 컴포넌트 파일은 삭제했고, 변경 대상 코드 파일은 각각 500줄 미만입니다.
- 배포 후 Ego Browser 확인: 로그인된 교사 계정으로 `https://paps-tracker.vercel.app/teacher`를 열어 세션 생성에 `4요인 평가 회차`와 `생성 모드` 문구가 없고 `세션 저장` 버튼이 있음을 확인했습니다. 업데이트 내역에서 `v1.2.5` 표시도 확인했습니다.
- 세션 목록에서 수정 버튼 6개와 삭제 버튼 6개를 관찰했습니다. 이전 v1.2.4 확인 당시 각 8개였으나, 원인은 추정하지 않았습니다.
- 브라우저 확인은 읽기 전용이었습니다. 세션 저장·수정·삭제 동작과 Google Sheets 쓰기를 수행하지 않았습니다.
- 앱 커밋·푸시: `a1994deda215d7cc4a8a2a708cb14fabd2a70b82`를 현재 브랜치에 푸시했습니다.
- Vercel Production 배포: `dpl_GzYPGeDbPzXPNzGVMvFktwqoUChS`, 상태 `READY`, alias [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app). Vercel 원격 프로덕션 빌드가 완료됐습니다.
- 남은 위험: 실제 Sheets 쓰기 및 연결 데이터 기반 동작은 이번 확인 범위가 아니며 검증하지 않았습니다.
- 롤백 포인트: 이번 릴리스 앱 커밋 직전의 Production 배포 이력.
- 후속 기록 커밋은 QA 보고서와 릴리스 체크리스트만 변경하며 앱을 재배포하지 않습니다.

## v1.2.4 릴리스 게이트 (2026-09-29)

- 전체 테스트 종료 문제: `SessionStatusList`가 렌더마다 새로운 기본 `archivedSessions=[]`를 만들어 effect가 상태 갱신과 재렌더를 반복했습니다. 안정된 빈 배열 상수로 기본값을 고정했습니다.
- 재현·수정 검증: Node.js 22 런타임 `/private/tmp/paps-release-runtime/node_modules/node/bin/node`에서 `npm run test:ci` 종료 코드 0, 85개 파일·349개 테스트 통과.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run audit:prod`, `git diff --check`: 모두 통과.
- 세션 수정·삭제: 기존 측정 시도가 있는 세션은 기록을 보존하며 보관하고, 기록이 없는 세션만 설정에서 삭제합니다. 보관 세션 복원을 지원합니다.
- Google Sheets 데이터 경계: 이번 릴리스 준비와 검증에서 운영 Google Sheets에 쓰기를 수행하지 않았습니다. 기존 학생 측정 행·기록은 수정·삭제하지 않았습니다.
- 범위 검토: 지정 변경 코드 파일은 모두 500줄 미만입니다.
- Production 배포 앱 커밋: `2452faddd3c46193a756d55c8145d4bc30d3d665`를 현재 브랜치에 푸시했습니다.
- Vercel Production: deployment `dpl_E8gEKFD6WUADsVWXxfj69JuzNyeA`, 상태 `READY`, alias [https://paps-tracker.vercel.app](https://paps-tracker.vercel.app). Vercel 빌드가 통과했습니다.
- 로그인된 교사 화면 읽기 전용 확인: v1.2.4 업데이트 내역, 삭제 버튼 8개, 중복 종목 수정 안내를 확인했습니다. 저장·삭제 동작은 실행하지 않았습니다.
- 실제 데이터 경계: 교사 화면 확인과 릴리스 과정에서 Google Sheets 쓰기 0건이며 기존 학생 측정 데이터 변경 0건입니다.
- 문서 후속 커밋은 앱 커밋 이후 QA 보고서와 체크리스트만 기록합니다. 배포 대상 앱 SHA는 위 `2452fadd...`이며 문서 커밋은 앱을 변경하지 않고 재배포하지 않습니다.

# QA 보고서: v1.2.3 학생·교사 UX 및 기록 보존 개선

## v1.2.3 현재 릴리스 게이트 (2026-09-29)

- 실행 환경: 임시 npm 캐시와 런타임에 설치한 Node.js `v22.23.3`, npm `10.9.9`. 프로젝트 엔진 범위(`>=22.0.0 <23.0.0`)에서 검증했습니다. 기존 사용자 npm 캐시의 권한 오류를 피하기 위해 `/private/tmp` 아래의 별도 캐시를 사용했습니다.
- 보안 수정: `package.json`의 Next `sharp` override와 `package-lock.json`의 `sharp` 및 플랫폼별 optional 패키지를 `0.35.4`로 동기화했습니다. `npm ls sharp --all --depth=2`에서 `sharp@0.35.4 overridden`을 확인했습니다.
- `npm ci --no-audit --no-fund`: 통과. Node 22/npm 10에서 lockfile 기반으로 490개 패키지를 재설치했습니다.
- `npm run audit:prod`: 통과. 운영 의존성 취약점 0건입니다.
- `npm run test:ci`: 통과, 85개 파일·345개 테스트. 위 clean install 이후 Node 22에서 실행했습니다.
- `npm run lint`: 통과.
- `npm run typecheck`: 통과.
- `npm run build`: 통과. 위 clean install 이후 Node 22에서 빌드했으며 Browserslist 데이터가 오래됐다는 안내가 있었습니다.
- `git diff --check`: 통과.
- 독립 QA Google Sheets 실연동: 검증 불가. 로컬 민감 키의 인증 오류 및 Drive 메타데이터 403으로 사전 읽기 단계가 막혀 시트 접근·쓰기 시험은 실행하지 않았습니다. 쓰기 0건이며 운영 측정 데이터는 변경하지 않았습니다.
- 커밋·푸시·배포: 앱 커밋 `54da59b1eedc45bb081619f31d618db75f94494c`을 추적 브랜치에 푸시했습니다. GitHub Actions run `36519492546`에서 Node 22의 설치·감사·테스트·린트·타입 검사·빌드가 모두 통과했습니다. Vercel Production deployment `dpl_9YUpLzAvroN6RPXv4GYgQpifHjsQ`는 `READY`이고 기본 주소에 alias가 연결됐습니다.
- Production 읽기 전용 확인: `https://paps-tracker.vercel.app/` HTTP 200과 `v1.2.3`·업데이트 내역, `/api/health` HTTP 200·`ready: true`, 비로그인 `/teacher`와 `/teacher/results`의 `/auth/signin` 307 이동, `/icon.svg` HTTP 200·`image/svg+xml`을 확인했습니다.
- Ego Browser에서 사용자 계정으로 로그인된 `/teacher`, `/teacher/settings`, `/teacher/students`, `/teacher/results`를 읽기 전용으로 열었습니다. 업데이트 내역 대화상자에 `v1.2.3`이 표시됐고, 네 경로 모두 320·375·768·1280px에서 문서 가로 넘침이 없었습니다. 설정에 빈 PAPS 시트 다운로드 경로와 연결 안내가 표시됩니다.
- 이 계정의 현재 학교 시트 연결 상태는 `구글 시트가 아직 연결되지 않았습니다`입니다. 따라서 실제 기록 표·그래프·Google Sheets 동시 작업은 인증된 브라우저에서도 검증할 수 없었습니다. Production Google Sheets 쓰기와 측정 기록 변경은 수행하지 않았습니다.

이하의 v1.2.1 배포·실시 기록은 과거 릴리스의 참고 자료이며 v1.2.3 검증 증거가 아닙니다.

## 범위

- Next.js 15.5.24, Auth.js beta.32, PostCSS·nanoid·sharp 보안 패치
- SheetJS 공식 CDN xlsx 0.20.3 tarball 설치와 XLSX 내보내기 회귀
- 교사 인증·인가 경계와 체지방 제외 4요인 회차 계산·UI·저장 회귀
- 격리된 실제 Google Sheets에서 회차 생성→학생 4종 제출→대표값 선택→교사 확정→학생 재조회 E2E
- 운영 의존성 감사 게이트, 버전·업데이트 내역, CI 재현성

## 실행 환경

- 실행일: 2026-08-26
- Node.js: v22.23.2 (Node 22 런타임)
- npm: v11.9.0
- 작업 버전: `1.2.1`
- 운영 데이터와 분리한 일회성 Google Sheets·서비스 계정 키를 사용했고, 앱의 Google OAuth 로그인은 테스트 세션으로 대체했습니다.

## 실행 명령과 결과

- `npm install`: 통과. lockfile과 node_modules 갱신 성공.
- `npm ci`: 통과. lockfile 기반 재설치 성공.
- `npm run audit:prod`: 통과 — `npm audit --omit=dev --audit-level=high`, 운영 취약점 0건.
- 의존성 트리: `next@15.5.24`, `next-auth@5.0.0-beta.32`, `@auth/core@0.41.3`, `postcss@8.5.26`, `nanoid@3.3.18`, `sharp@0.35.3`, `xlsx@0.20.3`.
- 인증·XLSX·4요인 집중 테스트: 13개 파일, 43개 테스트 통과.
- Node 22 전체 테스트: `npm run test:ci`, 72개 파일, 326개 테스트 통과.
- ESLint: `npm run lint`, 경고 없이 통과.
- TypeScript: `npm run typecheck`, 통과.
- Next.js 프로덕션 빌드: `NEXTAUTH_SECRET=ci-only-secret npm run build`, 신규 학생별 회차 상태 API를 포함한 페이지와 API route 생성 통과.
- `git diff --check`: 통과.
- GitHub Actions: 최종 공개 배포 SHA `f043526`의 run `32980675572`에서 Node 22 설치, `npm ci`, 운영 감사, 전체 테스트, 린트, 타입 검사, 프로덕션 빌드 통과.

## 핵심 기능 결과

- Auth.js beta.32와 `@auth/core` 0.41.3 갱신 후 로그인 화면, 교사 인증, 학교·세션 접근 범위 테스트가 통과했습니다.
- SheetJS 0.20.3 공식 tarball로 워크북 생성과 XLSX 다운로드 route 테스트가 통과했습니다.
- 네 요인 점수 경계·합계·등급, 회차 저장·대표값·확정·revision/stale, 학생 진행 UI와 교사 UI 회귀가 통과했습니다.
- 체지방·BMI를 4요인 회차 요청·계산·저장 계약에 포함하지 않는 테스트가 통과했습니다.
- 격리 Google Sheets E2E에서 4개 요인 점수 `19/20/16/20`, 합계 `75/80`, 환산점수 `93.75/100`, `1등급`이 서버 계산·시트 저장·학생 재조회에서 일치했습니다.
- `PROJECT_CONTEXT.md`는 이번 변경에서 수정하지 않았고 기존 작업 트리 상태를 보존했습니다.

## 브라우저 및 실제 Google Sheets 연동 결과

- v1.2.1 프로덕션 서버에서 1280×800·390×812 랜딩 브라우저 스모크를 수행했습니다. 두 화면 모두 HTTP 200, 콘솔·page 오류 0건, 가로 넘침 0이었고 업데이트 창에서 `운영 의존성 보안 패치`와 `체지방 제외 4요인 평가 회차`를 확인했습니다.
- 운영 템플릿이나 실제 학생 자료를 사용하지 않고, 사용자 소유의 빈 격리 시트에 v0.1 탭·헤더를 만든 뒤 앱이 `v0.2-four-factor-round`와 `4요인회차결과` 탭을 보강하는 흐름을 검증했습니다.
- 가상 학교·학급·학생과 `2026 1차 4요인 E2E` 회차를 생성하고 왕복오래달리기 100회, 앉아윗몸앞으로굽히기 30cm, 윗몸말아올리기 60회, 제자리멀리뛰기 250cm를 제출했습니다.
- 네 대표값 선택 후 미리보기와 확정 API가 `19/20/16/20`, `75/80`, `93.75/100`, `1등급`을 만들었고, 시트에는 revision 1·finalized 상태·규칙 버전·출처·확정 시각이 저장됐습니다.
- 결과 탭의 측정 열에는 BMI·체지방 항목이 없으며, 학생이 새로 접속해 자기 이름을 다시 선택했을 때 `4/4`와 같은 확정 결과가 복원됐습니다.
- 첫 E2E에서 Google Sheets 제출 진행 요인이 객체로 반환되어 학생 화면이 중단되는 계약 불일치를 발견해 배열로 통일했습니다.
- 교사 확정 후 학생 페이지 재접속 시 0/4로 돌아가던 문제는 서명된 그룹 토큰으로 선택 학생 1명의 상태만 읽는 API를 추가해 수정했습니다. 다른 학생 결과와 누적 이력은 응답하지 않습니다.
- 테스트가 끝난 뒤 격리 시트는 Google Drive 휴지통으로 이동했고, 새로 발급한 임시 서비스 계정 키만 폐기했습니다. 기존 사용자 관리 키 1개가 그대로 남은 것도 확인했습니다.

### Production 환경변수와 OAuth 상태

- Vercel CLI 기기 인증을 완료하고 Production 환경변수를 `.env.local`로 내려받았습니다. `.env.local`은 기존 `.gitignore` 규칙으로 계속 제외되며 값은 로그에 출력하지 않았습니다.
- Vercel에서 `GOOGLE_CLIENT_SECRET`과 `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`가 `Sensitive`로 저장되어 있어 실제 원문은 CLI로 다시 읽을 수 없고 대체 문자열만 내려왔습니다. 이는 Sensitive 값이 생성 후 읽기 불가능하다는 [Vercel 공식 정책](https://vercel.com/docs/environment-variables/sensitive-environment-variables)과 일치합니다.
- Production의 기존 `GOOGLE_SHEETS_TEMPLATE_ID`는 현재 사용자와 임시 서비스 계정 모두에서 404였으므로 운영 템플릿의 존재·공유 상태는 별도로 바로잡아야 합니다.
- 앱의 실제 Google OAuth 로그인과 Production 자격증명 유효성은 아직 검증하지 않았습니다. 이번 E2E는 서명된 테스트 교사 세션과 일회성 서비스 계정 키를 사용했습니다.
- 운영 배포와 운영 Google Sheet에는 변경이나 쓰기를 수행하지 않았습니다.

브라우저 증거:

- `output/playwright/home-desktop.png`
- `output/playwright/home-mobile-390x812.png`
- `output/playwright/paps-e2e-student-finalized.png`
- `output/playwright/paps-e2e-teacher-finalized.png`
- `output/playwright/paps-production-home-desktop.png`
- `output/playwright/paps-production-home-mobile-390x812.png`
- `output/playwright/paps-production-update-info.png`

### Production 배포 후 공개 검증

- 최종 커밋 `f043526ea39f38407a0a7ec7ed1920ed4d613a40`을 Vercel deployment `dpl_G387R4VUYXkTiUTcEfn7GDUrgBvs`로 배포했고 `READY`, `production`, Node `22.x`, aliasAssigned `true`를 API로 확인했습니다.
- 공개 주소 `https://paps-tracker.vercel.app`은 HTTP 200이며 랜딩에서 `v1.2.1`, 4요인 회차, Sheets 응답·재조회 보정, favicon 개선 내역을 확인했습니다.
- `/api/health`는 HTTP 200, `ready: true`이고 Google OAuth·교사 접근 정책·Google Sheets 필수 환경변수 이름이 준비된 상태입니다.
- 비로그인 `/teacher`와 `/teacher/results`는 `/auth/signin`으로 307 리다이렉트되고, 비로그인 회차 생성 API는 401을 반환했습니다.
- Google 로그인 버튼은 `redirect_uri_mismatch` 없이 Google 계정 로그인 화면으로 이동했고 Production callback은 `https://paps-tracker.vercel.app/api/auth/callback/google`로 전달됐습니다. 실제 교사 계정의 인증 완료는 수행하지 않았습니다.
- 신규 `/icon.svg`는 HTTP 200·`image/svg+xml`이며, 새 브라우저 세션의 앱 콘솔 오류·경고는 0건입니다.
- 390×812 브라우저에서 가로 넘침이 없고 데스크톱·모바일·업데이트 대화상자를 육안으로 확인했습니다.

## 남은 위험과 권장 우선순위

### P0 — 운영 후속

- 실제 허용 도메인의 교사 계정으로 로그인을 완료하고 교사 대시보드 진입을 확인해야 합니다.
- Production 템플릿 ID는 현재 계정에서 404이므로 파일 존재·서비스 계정 공유 상태를 복구한 뒤 신규 학교 연결을 확인해야 합니다. Vercel Sensitive 값은 로컬로 복구할 수 없습니다.

### P1 — 의존성 유지보수

- 기본 `npm install`/`npm ci` 요약에는 dev 의존성 기준 3건(1 low, 2 high)이 표시됩니다. 운영 감사(`npm run audit:prod`)는 0건이며, dev 트리의 별도 업그레이드는 이번 범위에서 제외했습니다.
- `npm audit fix --force`와 Next 16 등 무관한 메이저 업그레이드는 실행하지 않았습니다.

### P2 — 기존 운영 위험

- Google Sheets 결과 revision 중복 방지는 읽기 후 append 방식이므로 완전한 원자적 잠금은 아닙니다.
- Production 템플릿 공유 상태가 복구되기 전에는 신규 학교의 템플릿 사본 생성 흐름에 위험이 남습니다.

## 결론

- 의존성 보안 게이트와 로컬 품질 게이트: 통과
- 격리 Google Sheets 4요인 E2E: 통과
- Production OAuth redirect·접근 경계·공개 UI: 통과
- 실제 교사 로그인 완료·Production 템플릿: 미검증
- 커밋·푸시·Production 배포: 완료
