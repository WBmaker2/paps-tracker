# 백엔드 핸드오프

## 2026-08-26 체지방 제외 4요인 점수 코어

- 구현 파일: `src/lib/paps/types.ts`, `src/data/paps/events.ts`, `src/data/paps/score-rules.ts`, `src/lib/paps/four-factor-score.ts`
- `PAPSFourFactorId`는 심폐지구력·유연성·근력·근지구력·순발력 네 값만 사용하며, 기존 9개 `EventId`에 `factorId`를 빠짐없이 부여했습니다.
- `score-rules.ts`는 현행 학교건강검사규칙 별표 4·5와 2026 나이스 PAPS 매뉴얼에 제시된 초4~6 남녀 범위를 정수 precision 좌표로 고정합니다. 외곽 최소/최대값은 각각 0/20점으로 처리하고, 5등급 내부는 3등분, 4~1등급 내부는 4등분하며 경계 소수는 반올림합니다. 종합유연성은 4·8·12·16·20 고정점입니다.
- 규칙 버전은 `school-health-rule-2025-03-10-four-factor-v1`, 출처는 국가법령정보센터 학교건강검사규칙 별표 4·5 및 2026 나이스 PAPS 매뉴얼로 고정했습니다.
- `four-factor-score.ts`는 항목 점수(0~20), 4요인 합계(0~80), `subtotal * 1.25` 환산점수(0~100), 합계 16/32/48/64 경계 등급(5/4/3/2/1)을 계산합니다. 네 요인의 누락·중복과 확인되지 않은 종목 조합은 예외로 거부합니다.
- 전체 조합 회귀 테스트에서 48개 공식 조합 생성, 외곽 경계·band 연속성·방향별 단조성·0~20 범위를 검증했습니다.
- 검증: `npm test -- --run tests/paps` (6개 파일, 55개 통과), `npm run typecheck` 통과.

## 2026-08-26 백엔드 회차 저장/API 구현

- `PAPSAssessmentRound`, `PAPSStudentRoundResult`, 요인 snapshot/status/revision 타입과 `PAPSSession.assessmentRoundId`/`factorId`를 추가했습니다. `src/lib/paps/assessment-round.ts`가 네 요인 정확성·학년/세션 적격성·서버 fingerprint·미완료/제외 계산을 담당합니다.
- 메모리 저장은 `src/lib/store/paps-memory-round-store.ts`로 분리하고 기존 store state에 round/result 컬렉션을 연결했습니다. 회차 생성, preview, 단건/ready 확정, exclude, revision conflict, idempotency replay, stale 감지와 immutable revision을 제공합니다.
- `app/api/assessment-rounds/**`에 생성·조회·preview·단건 확정·ready 일괄 확정·학생 제외 endpoint를 추가했습니다. 생성 응답에는 기존 학생 그룹 URL을 재사용하는 `studentSessionUrl`을 포함하며 explicit round metadata 없는 legacy group은 승격하지 않습니다.
- 학생 submit은 assessment round 세션에서만 본인 `roundProgress`와 교사 확정 `finalizedResult`를 선택적으로 반환하고, legacy session은 기존 `historyAttempts` 응답을 유지합니다.
- Google Sheets에 `4요인회차결과` 전용 헤더/row serializer·parser·append schema migration helper와 `addSheet` client capability를 추가했습니다. v0.1 legacy tab read는 optional tab read 실패를 삼켜 기존 기능을 보존하고, round metadata는 설정 machine row에 별도 JSON으로 저장합니다.
- 검증: `npm run typecheck`; `tests/paps/assessment-round-store.test.ts`, `tests/google/four-factor-round-sheet.test.ts` 및 기존 focused PAPS/Sheets/session/authorization 테스트 통과.

## 최종 무결성 보완

- 회차가 참조하는 세션의 구조 변경·삭제와 대상 반 삭제를 409로 차단하여 회차 메타데이터가 고아 상태가 되지 않도록 했습니다.
- 설정 탭 직렬화·복원에서 회차 JSON과 세션의 `assessmentRoundId`/`factorId`가 유지되는지 검증합니다.
- 회차 결과 탭을 다시 읽을 때 0점과 `null`, 이전 revision, 5등급 경계가 보존되는지 검증합니다.
- Node 22 최종 게이트에서 71개 테스트 파일·324개 테스트, 린트, 타입 검사, 프로덕션 빌드가 모두 통과했습니다.
