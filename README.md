# PAPS Tracker

PAPS 학생 기록 시스템 MVP입니다. 교사용 관리 화면, 학생 세션 입력 화면, 대표값 선택, 파일 기반 데모 저장소, Google 로그인/Sheets 연동 준비, 구글 시트 프로토타입 payload 생성까지 포함합니다.

## Bootstrap Notes

Task 1 시작 시점에는 앱 파일이 없었기 때문에 아래 명령이 실패하는 것이 정상인 초기 상태였습니다.

```bash
npm install
npm run lint
npm run test
```

이제 같은 명령은 기본 스캐폴드 검증용으로 사용합니다.

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
