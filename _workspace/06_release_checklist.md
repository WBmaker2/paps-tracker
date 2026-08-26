# 배포 체크리스트: v1.2.1

## 기본 게이트

- [x] Node 22 전체 테스트 통과 — 72개 파일, 326개 테스트
- [x] 인증·XLSX·체지방 제외 4요인 집중 테스트 — 13개 파일, 43개 테스트
- [x] 린트 통과
- [x] 타입 검사 통과
- [x] Node 22 프로덕션 빌드 통과 — 학생별 회차 상태 API 포함
- [x] `npm audit --omit=dev` 0건
- [x] `npm ci` lockfile 재현 설치 통과
- [x] `git diff --check` 통과
- [x] 업데이트 내역 `v1.2.1` 확인
- [x] v1.2.1 데스크톱·390×812 모바일 브라우저 스모크 통과
- [x] CI에 `npm run audit:prod` 단계 추가
- [x] `PROJECT_CONTEXT.md` 기존 상태 보존
- [x] Vercel Production 환경변수 이름·대상 환경 확인
- [x] `.env.local` Git 제외와 비밀값 비출력 확인
- [x] GitHub Actions Node 22 실런 확인 — run `32980675572`
- [x] 격리 전용 실제 Google Sheets에서 4요인 생성→제출→대표값→확정→학생 재조회 확인
- [x] 임시 테스트 시트 Google Drive 휴지통 이동 확인
- [x] 신규 임시 서비스 계정 키 폐기 및 기존 키 보존 확인
- [x] Production 필수 환경변수 이름과 `/api/health` `ready: true` 확인
- [ ] Production 템플릿 파일 존재·서비스 계정 공유 상태 복구
- [x] Google OAuth가 `redirect_uri_mismatch` 없이 Google 계정 로그인 화면까지 이동
- [ ] 실제 허용 교사 계정 로그인 완료와 대시보드 진입 확인
- [x] 배포 후 공개 URL·버전·접근 경계·모바일·콘솔 확인

## 운영 환경변수

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`
- `GOOGLE_SHEETS_TEMPLATE_ID`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

## 배포 후 확인 경로

- `/`
- `/auth/signin`
- `/teacher`
- `/teacher/results`
- 신규 `/session-group/<roundId>?access=<token>`
- `/api/health`

## 운영 메모

- 결과 명칭은 항상 `체지방 제외 4요인`으로 유지하고 공식 PAPS 종합점수·종합등급으로 안내하지 않습니다.
- 실제 시트에 `4요인회차결과` 탭과 v0.2 설정이 생성된 뒤 재접속해 round/result가 복원되는지 확인합니다.
- 격리 E2E 기준 결과는 요인 점수 `19/20/16/20`, 합계 `75/80`, 환산점수 `93.75/100`, `1등급`이며 체지방·BMI 측정 열은 0개입니다.
- Production 템플릿 ID는 현재 계정에서 404이므로 신규 학교 연결 전에 파일 존재 여부와 서비스 계정 공유 권한을 복구합니다.
- 최종 앱 커밋 `f043526`, deployment `dpl_G387R4VUYXkTiUTcEfn7GDUrgBvs`, Production alias `https://paps-tracker.vercel.app`을 확인했습니다.

## 롤백 포인트

- 의존성 보안 작업 전 기준 커밋: `3576569` (`fix: keep latest grip result at chart end`)
- 데이터 롤백 시 `4요인회차결과` 탭을 먼저 백업하고, 기존 `세션기록`과 설정 탭은 보존합니다.
