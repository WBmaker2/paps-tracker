# PAPS Tracker

PAPS 학생 기록 시스템 MVP입니다. 교사용 관리 화면, 학생 세션 입력 화면, 대표값 선택, Google 로그인, Google Sheets 저장, 구글 시트 프로토타입 payload 생성까지 포함합니다.

## Available Scripts

```bash
npm install
npm run dev
npm run lint
npm run test
npm run migrate:demo-store -- --sheet <spreadsheetId>
```

## Current Routes

- `/`: 교사/학생 영역으로 이동하는 랜딩 페이지
- `/teacher`: 교사 관리 대시보드
- `/teacher/sessions`: 세션 생성 및 열림/닫힘 제어
- `/teacher/results`: 대표값 선택, 결과 요약, 동기화 상태 확인
- `/teacher/settings`: 학교 정보와 학급 설정
- `/session/demo-session-practice`: 데모 학생 입력 세션
- `/auth/signin`: 교사 로그인 안내 및 Google 로그인 진입

## Runtime Model

- 운영 데이터 저장소는 Google Sheets입니다.
- 학생 제출은 Google Sheets append가 성공해야만 완료됩니다.
- 개발 환경에서 `NEXTAUTH_SECRET`이 없으면 로컬 스모크 테스트를 위해 개발용 fallback secret을 사용합니다.
- legacy `demo-store.json`이 있다면 마이그레이션 스크립트로 시트에 옮긴 뒤 운영합니다.

## Environment

실제 Google 로그인과 Sheets 연동에 필요한 환경 변수 이름은 [`.env.example`](./.env.example)에 정리했습니다.

필수 항목:

- 교사 로그인: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- 교사 허용 범위: `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`
- 시트 템플릿/연동: `GOOGLE_SHEETS_TEMPLATE_ID` 및 서비스 계정 값

## Deploy To Vercel

무료 운영 기준 권장 배포는 `Vercel Hobby + Google Sheets` 입니다.

1. 저장소를 Vercel에 연결합니다.
2. `NEXTAUTH_URL`을 실제 배포 주소로 설정합니다.
3. `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`를 설정합니다.
4. `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`를 설정합니다.
5. `GOOGLE_SHEETS_TEMPLATE_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`를 설정합니다.
6. Google OAuth 승인된 리디렉션 URI에 `https://<your-vercel-domain>/api/auth/callback/google`를 추가합니다.

주의:

- 서버 로컬 파일 저장소를 운영 경로로 사용하지 않습니다.
- 학생 입력 전에 반드시 교사 화면에서 Google Sheets 연결을 끝내야 합니다.
- 서비스 계정 이메일을 교사가 사용하는 시트에 공유해야 합니다.

## Legacy Migration

legacy `demo-store.json`이 있으면 아래처럼 Google Sheets로 옮길 수 있습니다.

```bash
npm run migrate:demo-store -- --sheet <spreadsheetId>
```

옵션:

- `--input <path>`: legacy JSON 경로를 직접 지정합니다.
- `--school <schoolId>`: 여러 학교가 있으면 특정 학교만 선택합니다.
- `--write`: dry-run 대신 실제로 시트에 씁니다.

기본 legacy 경로는 `.data/paps/demo-store.json` 이고, 이 파일이 있을 때만 자동으로 사용합니다.

## MVP Limitations

- Google OAuth와 Google Sheets 실연동은 실제 자격 증명이 있어야 동작합니다.
- 교사 경로는 인증이 없으면 로그인 경로로 이동합니다.
- 다중 교사/다중 학교 운영 전에 서비스 계정 공유 정책을 학교별로 정리해야 합니다.
- 종목 표시 이름은 현재 앱 카탈로그 기준 문자열을 사용합니다.

## Testing

검증 명령:

```bash
npm run lint
npm run test
```

현재 검증 범위:

- PAPS 규칙/등급/요약 단위 테스트
- 교사 관리 흐름 컴포넌트 테스트
- 학생 세션 입력 흐름 테스트
- Google Sheets URL/payload 직렬화 테스트
