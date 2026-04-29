# Landing Update Info Design

## Goal

랜딩 페이지에서 현재 앱 상태를 `v1.0.0`으로 작게 표시하고, 사용자가 `Update info` 버튼을 눌러 PAPS Tracker가 MVP에서 완제품 흐름까지 발전한 과정을 팝업으로 확인할 수 있게 합니다.

## User Experience

- 랜딩 상단의 `PAPS Tracker` 표기 옆에 작은 버전 배지를 둡니다.
- 같은 영역에 `Update info` 버튼을 배치해 버전 정보가 보조 정보임을 드러냅니다.
- 버튼을 누르면 배경 위에 모달 팝업이 뜨고, `v1.0.0`부터 `v0.1.0`까지 주요 변화가 최신순으로 보입니다.
- 팝업은 `닫기` 버튼과 바깥 영역 클릭으로 닫을 수 있습니다.
- 별도 문서 `docs/update-history.md`에도 동일한 흐름을 남겨 개발자가 변경 이력을 추적할 수 있게 합니다.

## Data Model

업데이트 기록은 `src/lib/update-history.ts`에서 관리합니다.

- `APP_VERSION`: 랜딩에 노출할 현재 버전 문자열
- `UPDATE_HISTORY`: 버전, 제목, 요약, 주요 변경점 목록

문서와 UI가 같은 메시지를 공유하되, 문서는 사람이 읽기 쉬운 긴 형식으로 유지합니다.
