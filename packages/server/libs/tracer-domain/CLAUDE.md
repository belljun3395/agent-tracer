# packages/server/libs/tracer-domain

읽기 모델의 엔티티와 저장소 구현, 그리고 그 모델의 도메인 규칙이다. `projector`가 쓰고
`tracer-api`가 읽는다. 앱은 서로를 import하지 못하므로 두 앱이 같은 판정을 내려야 하는
규칙(태스크 상태 전이, 턴 조립, 이벤트 표현, 레시피 수명주기)이 여기 있다.

## 폴더

- `persistence/`: TypeORM 엔티티, 데이터소스, 마이그레이션, 투영 재생성 테이블 분류.
- `task/` `timeline/` `job/` `rule/` `recipe/` `cleanup/` `settings/` `user/` `search/`
  `daemon/`: 각 읽기 모델의 순수 도메인 규칙.
- `error/`: 이 라이브러리가 던지는 도메인 오류.
- `migrations/`: TypeORM 마이그레이션 파일.
- `__fixtures__/`: 저장소 테스트가 공유하는 픽스처.

## 이 패키지만의 제약

- 스키마는 엔티티가 단독으로 소유한다. 마이그레이션은 엔티티에서 생성하며 손으로 쓴
  DDL로 컬럼이나 인덱스를 더하지 않는다. `npm run migration:generate` /
  `npm run migration:run`으로 만들고 돌린다.
- `persistence/projection.tables.ts`의 재생성 화이트리스트가
  `scripts/rebuild-projection.mjs`와 `scripts/e2e/failure-scenarios.mjs`의 유일한
  진실 원천이다. 새 투영 테이블을 추가하면 이 화이트리스트도 함께 갱신한다.
- TypeORM은 이 라이브러리와 각 앱의 `adapter/`·`config/`·`migrations` 밖으로 새지 않는다.

## 검증

```bash
npx vitest run packages/server/libs/tracer-domain && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
