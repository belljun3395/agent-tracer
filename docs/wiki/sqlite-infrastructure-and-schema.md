# SQLite Infrastructure & Schema

Agent Tracer의 실제 저장 경로는 `packages/server/src/infrastructure/sqlite` 아래 구현들이다.

## 구성 요소

- `sqlite-task-repository.ts`
- `sqlite-session-repository.ts`
- `sqlite-event-repository.ts`
- `sqlite-runtime-binding-repository.ts`
- `sqlite-bookmark-repository.ts`
- `sqlite-evaluation-repository.ts`
- `sqlite-schema.ts`
- `sqlite-schema-migrator.ts`

## 실제 활성 경로

- 조합 루트는 `sqlite/index.ts`
- legacy 성격의 `monitor-database.ts`는 현재 활성 경로가 아니다

## 유지보수 메모

- `displayTitle` 계산을 위한 추가 read
- evaluation search 시 이벤트 재조회 비용
- legacy 구현이 문서와 온보딩을 혼란스럽게 할 수 있음
