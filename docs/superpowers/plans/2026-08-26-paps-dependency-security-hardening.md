# PAPS Tracker 운영 의존성 보안 강화 계획

- 작성일: 2026-08-26
- 상태: 구현 완료, 로컬 QA 완료
- 범위: 운영 의존성 취약점 제거, 재발 방지 게이트, 버전·업데이트 내역 반영
- 비범위: 커밋·푸시·배포, 운영 OAuth/Google Sheets 자격증명 변경

## 1. 목표

현재 `npm audit --omit=dev`에서 확인되는 운영 의존성 취약점 7건(critical 2, high 5)을 강제 메이저 업그레이드 없이 제거한다. 패키지 업데이트 후 기존 체지방 제외 4요인 회차, 교사 인증, Google Sheets, XLSX 내보내기 동작이 유지되는지 전체 회귀로 확인한다.

```text
현재 취약 버전 확인
  → 패치 버전만 선택
  → lockfile 재생성
  → audit 0건 확인
  → 인증·XLSX 집중 테스트
  → 전체 테스트·린트·타입·빌드
  → CI 보안 게이트 추가
```

## 2. 확인된 취약 경로와 권장 조치

| 경로 | 현재 | 조치 | 호환성 경계 |
|---|---:|---:|---|
| `next` | 15.5.20 | 15.5.24 | Next 15 유지, 메이저 업그레이드 없음 |
| `next-auth` | 5.0.0-beta.31 | 5.0.0-beta.32 | Auth.js v5 API 유지, `@auth/core` 0.41.3 포함 |
| `postcss` | 8.5.17 및 Next 내부 8.4.31 | 8.5.26 override | 같은 메이저, Next 내부 취약 버전도 교체 |
| `nanoid` | 3.3.15 | 3.3.18 override | 같은 메이저, PostCSS 하위 경로 교체 |
| `sharp` | 0.34.5 | 0.35.3 override | Next 15.5.24가 허용하는 패치 계열 |
| `xlsx` | npm registry 0.18.5 | SheetJS 공식 CDN 0.20.3 | 기존 API를 유지하고 공식 패치 배포본 사용 |

`npm audit fix --force`는 사용하지 않는다. `next` 16, ESLint 10, Tailwind 4 등 이번 취약점과 무관한 메이저 업그레이드는 포함하지 않는다.

## 3. 구현 작업

1. `package.json`의 직접 의존성 버전을 위 표대로 갱신한다.
2. Next 내부 의존성까지 안전 버전으로 고정하도록 최소 `overrides`를 추가한다.
3. `xlsx`는 SheetJS 공식 설치 지침의 0.20.3 tarball URL로 교체한다.
4. `npm install`로 `package-lock.json`을 갱신하고 `npm ci` 재현성을 확인한다.
5. `audit:prod` 스크립트와 GitHub Actions 단계를 추가해 high 이상 취약점이 재발하면 CI가 실패하도록 한다.
6. 앱 버전을 1.2.1로 올리고 업데이트 내역에 보안 패치와 동작 변경 없음 사실을 기록한다.
7. 기존 QA 보고서와 배포 체크리스트의 보안 상태를 실제 검증 결과에 맞게 갱신한다.

## 4. 검증 계약

다음 검증이 모두 통과해야 완료로 판정한다.

- `npm audit --omit=dev`: 취약점 0건
- `npm ci`: lockfile 기반 새 설치 성공
- Auth.js 집중 테스트: 로그인 화면, 교사 인증·인가 경계
- XLSX 집중 테스트: 워크북 생성 및 다운로드 route
- 체지방 제외 4요인 집중 테스트: 계산·교사 UI·학생 UI·회차 저장
- Node 22 전체 Vitest
- ESLint, TypeScript
- Next.js 프로덕션 빌드
- `git diff --check`
- `PROJECT_CONTEXT.md` 미변경

## 5. 중단 조건과 대안

- 같은 설치·빌드 문제가 세 번 반복되면 추가 강제 override를 쌓지 않고 원인을 정리해 사용자와 협의한다.
- SheetJS 공식 tarball이 설치 또는 번들 환경과 호환되지 않으면 ExcelJS 이전을 별도 설계로 분리한다.
- Auth.js 패치에서 API 불일치가 발생하면 인증 코드를 임의 우회하지 않고 beta.32 변경사항에 맞춘 최소 수정만 검토한다.

## 6. 다음 게이트

이 계획 완료 후에도 배포 전에는 운영 Google OAuth, 교사 허용 범위, 서비스 계정, Google Sheets 사본을 이용한 생성→4종 측정→대표값→확정→재조회 실환경 검증이 필요하다.
