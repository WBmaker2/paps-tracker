# 배포 메모: v1.2.1

## 배포 대상

- GitHub: `WBmaker2/paps-tracker`
- 브랜치: `codex/student-growth-ui-improvements`
- 기능 커밋: `e52e06c1ca5a04c81deed0c5f686970ed814a835`
- Vercel 팀/프로젝트: `wbmaker2s-projects/paps-tracker`
- Production 공개 주소: `https://paps-tracker.vercel.app`

## 배포 전 근거

- GitHub Actions run `32979216162`: Node 22 설치, `npm ci`, 운영 의존성 감사, 72개 파일·326개 테스트, 린트, 타입 검사, 프로덕션 빌드 통과
- Vercel 필수 Production 환경변수 이름 7개와 적용 환경 확인. 값은 문서와 로그에 기록하지 않음
- Vercel 배포 메타데이터의 Node.js 버전이 `22.x`로 해석되는 것을 확인
- 사용자 파일 `PROJECT_CONTEXT.md`, 로컬 `.env.local`, Playwright 증거 이미지는 릴리스 커밋과 배포 소스에서 제외

## 배포 실행 기록

- 첫 CLI 배포 `dpl_BQR96Cb4XJXyG356LPVmWWFcUAoV`는 빌드 전에 `TEAM_ACCESS_REQUIRED`로 차단됨
- 원인: 자동 생성된 로컬 Git 작성자 이메일이 Vercel 팀 구성원으로 인식되지 않음
- 조치: GitHub 계정 `WBmaker2`의 noreply 이메일로 저장소 로컬 작성자 설정을 고정하고 후속 릴리스 메타데이터 커밋을 사용
- 차단된 배포는 alias가 할당되지 않았고 기존 Production 트래픽을 변경하지 않음

## 배포 후 검증 예정

- [ ] 최종 deployment ID와 `READY` 상태
- [ ] `https://paps-tracker.vercel.app` HTTP 200
- [ ] 랜딩의 `v1.2.1` 및 업데이트 내역
- [ ] `/api/health` HTTP 200과 환경 준비 상태
- [ ] `/auth/signin`, `/teacher`, `/teacher/results` 접근 경계
- [ ] 데스크톱·390px 모바일 가로 넘침 및 콘솔 오류

## 롤백

- 배포 전 Production alias가 가리키던 배포를 Vercel에서 다시 승격한다.
- 소스 기준 롤백 포인트는 `3576569`이며, Google Sheets 기존 탭과 기록은 삭제하지 않는다.
