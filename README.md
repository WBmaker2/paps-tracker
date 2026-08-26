# PAPS Tracker

PAPS Tracker는 교사가 학교·학급·학생 명단과 측정 세션을 준비하고, 학생 기록 입력부터 누적 성장 확인, 대표값 검토, Google Sheets 동기화까지 운영하는 웹앱입니다.

현재 앱 버전은 `v1.2.1`이며 자세한 발전 과정은 [업데이트 기록](./docs/update-history.md)에서 확인할 수 있습니다.

## Requirements

- Node.js 22
- npm 10 이상
- Google OAuth 애플리케이션
- Google Sheets API를 사용할 서비스 계정
- PAPS Tracker 템플릿의 Google Sheets 사본

Node 버전은 [`.nvmrc`](./.nvmrc)와 `package.json#engines`에 고정되어 있습니다.

## Local Development

```bash
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

주요 명령:

```bash
npm run test:ci
npm run lint
npm run typecheck
npm run build
```

## Routes

- `/`: 버전과 업데이트 내역을 포함한 교사 시작 랜딩 페이지
- `/auth/signin`: Google 교사 로그인
- `/teacher`: 세션 생성·수정·열기·닫기를 포함한 교사 홈
- `/teacher/students`: 학급별 학생 명단 추가·수정·삭제
- `/teacher/results`: 결과 필터, 학생별 성장 조회, 대표값 선택, 요약 내보내기
- `/teacher/settings`: 학교 시트 연결, 교사 복귀 PIN, 학급 관리
- `/teacher/sessions`: 호환성을 위해 `/teacher`로 이동
- `/session/[sessionId]`: 단일 종목 학생 입력
- `/session-group/[sessionGroupId]`: 여러 종목 학생 입력

학생은 교사가 연 세션의 링크 또는 QR 코드로 접속합니다. 현장에서 교사가 직접 지도하는 운영 방식을 유지하므로 학생별 별도 인증이나 만료 링크는 적용하지 않습니다.

## Security Model

- Google 로그인이 성공해도 `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`에 포함된 이메일만 교사 화면에 들어갈 수 있습니다.
- 두 환경변수가 모두 없으면 교사 로그인을 허용하지 않는 fail-closed 방식입니다.
- 담당교사가 이미 저장된 기존 시트에는 현재 교사가 스스로 등록할 수 없습니다.
- 기존 담당교사가 설정 화면에서 대상 이메일 전용 **교사 초대 승인 코드**를 발급해야 하며, 코드는 해당 시트에서 15분 동안만 유효합니다.
- 수동 동기화는 현재 로그인 교사가 연결한 Google Sheet에만 쓸 수 있습니다.
- 학생 화면에서 교사 화면으로 돌아갈 때는 시트에 해시로 저장된 교사용 PIN을 확인합니다.

## Google Sheets Data Flow

Google Sheets가 운영 데이터의 기준 저장소입니다.

- 학생 제출은 `세션기록` 원본 행 저장이 성공해야 완료됩니다.
- 제출 직후에는 해당 학생·종목의 `학생요약` 행만 갱신합니다.
- 전체 `학생요약`·`공식평가요약` 재계산은 결과 화면의 수동 복구 기능에서만 실행합니다.
- 교사 화면은 Smart Polling과 로컬 부분 반영으로 시트 변경을 다시 읽습니다.
- 서비스 계정 이메일에는 연결할 시트의 편집자 권한이 필요합니다.

## Environment

전체 예시는 [`.env.example`](./.env.example)을 참고하세요.

필수 항목:

- 인증: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- 교사 범위: `GOOGLE_HOSTED_DOMAIN` 또는 `TEACHER_EMAIL_ALLOWLIST`
- Sheets: `GOOGLE_SHEETS_TEMPLATE_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`

Google OAuth 승인된 리디렉션 URI에는 다음 주소가 필요합니다.

```text
https://<your-domain>/api/auth/callback/google
```

## CI And Deployment

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)은 push와 pull request마다 Node.js 22에서 다음 순서를 검증합니다.

1. `npm ci`
2. `npm run test:ci`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run build`

권장 운영 구성은 `Vercel + Google Sheets`입니다. Vercel 프로젝트에 위 환경변수를 등록하고, OAuth 리디렉션 URI와 서비스 계정 공유 권한을 함께 설정해야 합니다.

## Architecture

- `app/`: Next.js App Router 페이지와 API 경로
- `src/components/teacher/`: 교사 화면 상태 컨테이너와 역할별 카드
- `src/components/ui/`: 접근성 대화상자와 라이브 상태 알림
- `src/lib/google/sheets-submit.ts`: 학생 제출 검증과 원본 기록 저장 조정
- `src/lib/google/sheet-student-session-views.ts`: 학생 세션 화면과 누적 이력 조회
- `src/lib/google/sheet-summary-row-persistence.ts`: 제출 후 요약 단일 행 갱신
- `src/lib/google/sheets-rebuild.ts`: 수동 전체 요약 복구

## Legacy Migration

기존 `.data/paps/demo-store.json`이 있을 때만 아래 명령으로 Google Sheets 이관을 준비할 수 있습니다.

```bash
npm run migrate:demo-store -- --sheet <spreadsheetId>
```

`--write`를 추가하지 않으면 dry-run으로 실행됩니다.
