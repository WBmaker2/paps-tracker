# PAPS Tracker

PAPS 학생 기록 시스템 MVP입니다. 교사용 관리 화면, 학생 세션 입력 화면, 대표값 선택, 파일 기반 데모 저장소, Google 로그인/Sheets 연동 준비, 구글 시트 프로토타입 payload 생성까지 포함합니다.

## Available Scripts

```bash
npm install
npm run dev
npm run lint
npm run test
```

## Current Routes

- `/`: 교사/학생 영역으로 이동하는 랜딩 페이지
- `/teacher`: 교사 관리 대시보드
- `/teacher/sessions`: 세션 생성 및 열림/닫힘 제어
- `/teacher/results`: 대표값 선택, 결과 요약, 동기화 상태 확인
- `/teacher/settings`: 학교 정보와 학급 설정
- `/session/demo-session-practice`: 데모 학생 입력 세션
- `/auth/signin`: 교사 로그인 안내 및 Google 로그인 진입

## Demo Mode

- 학생 세션은 파일 기반 데모 저장소로 바로 동작합니다.
- 교사 화면 데이터도 기본적으로 데모 저장소를 사용합니다.
- 개발 환경에서 `NEXTAUTH_SECRET`이 없으면 로컬 스모크 테스트를 위해 개발용 fallback secret을 사용합니다.

## Environment

실제 Google 로그인과 Sheets 연동에 필요한 환경 변수 이름은 [`.env.example`](./.env.example)에 정리했습니다.

필수 항목:

- 교사 로그인: `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- 교사 허용 범위: `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`
- 시트 템플릿/연동: `GOOGLE_SHEETS_TEMPLATE_ID` 및 서비스 계정 값

## Deploy To Render

루트의 [`render.yaml`](./render.yaml)로 Render Blueprint 배포를 바로 시작할 수 있습니다.

1. GitHub 저장소를 Render에 연결하고 Blueprint 배포를 선택합니다.
2. `render.yaml`을 읽어 `paps-tracker` 웹 서비스를 생성합니다.
3. `NEXTAUTH_URL`은 실제 Render 주소로 입력합니다.
4. 교사 로그인을 쓸 경우 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, 그리고 `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`를 설정합니다.
5. Google OAuth 승인된 리디렉션 URI에 `https://<your-render-domain>/api/auth/callback/google`를 추가합니다.

Render 설정 기준:

- 인스턴스 타입: `starter`
- 리전: `singapore`
- 헬스체크: `/api/health`
- Persistent Disk 마운트 경로: `/var/data/paps`
- 앱 저장 경로(`PAPS_STORE_PATH`): `/var/data/paps/demo-store.json`

주의:

- Render는 기본 파일시스템이 ephemeral이므로, 현재 MVP처럼 파일 저장소를 쓸 때는 Persistent Disk가 꼭 필요합니다.
- Persistent Disk는 유료 웹 서비스에서만 사용할 수 있습니다.
- 디스크가 붙은 서비스는 다중 인스턴스 확장이 불가하므로 현재 설정은 `numInstances: 1`입니다.

## MVP Limitations

- Google OAuth와 Google Sheets 실연동은 실제 자격 증명이 있어야 동작합니다.
- 교사 경로는 인증이 없으면 로그인 경로로 이동합니다.
- 현재 저장소는 로컬 파일 기반 데모 저장소이며, 다중 사용자 실서비스 DB는 아직 아닙니다.
- 구글 시트 payload는 프로토타입 워크북 헤더에 맞춰 생성되지만, 실제 API 쓰기는 stubbed 응답입니다.
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
