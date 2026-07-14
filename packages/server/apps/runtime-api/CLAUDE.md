# packages/server/apps/runtime-api

쓰기 전용. 에이전트가 보내는 이벤트를 원장에 적재한다.

## 슬라이스

- `ingest`: 이벤트 수집. 같은 클라이언트 식별자로 두 번 보내도 한 번만 쌓인다.
- `cold`: 원장 보관과 보존. 파티션 만료분을 Parquet로 내보내고 드롭한다.
- `health`: 헬스와 준비 상태.

## 이 패키지만의 제약

- 읽기 모델(`@monitor/tracer-domain`)을 import하지 않는다. 조회는 이 앱의 책임이 아니다.
- 원장 스키마는 `runtime.datasource.ts`가 가리키는 엔티티가 소유한다. 마이그레이션은
  `npm run migration:generate:runtime` / `npm run migration:run:runtime`로 만들고 돌린다.
- 다만 시간 파티셔닝과 pg_partman과 Debezium 퍼블리케이션은 ORM이 말할 수 없어 마이그레이션이
  소유한다. 인덱스와 기본값은 말할 수 있으므로 엔티티에 둔다.
- 생성기가 `events_task_seq`를 지웠다 다시 만드는 차이를 내면 버린다. 컬럼을 알파벳 순으로
  읽어 생기는 오해이고, 엔티티의 `(task_id, seq)`가 옳다.
- 콜드 티어 내보내기는 `cold.entry.ts`가 별도 진입점이다. `main.ts`의 HTTP 서버와
  같은 프로세스에서 상시로 돌지 않는다.

## 검증

```bash
npx vitest run packages/server/apps/runtime-api && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
