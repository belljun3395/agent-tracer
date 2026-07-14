# packages/server/apps/projector

원장을 소비해 읽기 모델로 투영한다. 이 앱만 슬라이스의 축이 도메인이 아니라 기능이다.

## 슬라이스

- `project/`: 원장 배치를 받아 트랜잭션을 열고 각 투영 단계를 호출한 뒤 마지막 적용
  시퀀스를 갱신하고 커밋한다. 진입점은 유스케이스 하나다.
- `notify/`: 투영 결과를 알림으로 발행한다.
- `index/`: 검색 인덱스를 채운다.
- `export/`: 관측 파이프라인(OTLP)으로 내보낸다.
- `recover/`: 중단된 잡과 태스크와 스텝을 회수한다.

## 이 패키지만의 제약

- `project/`의 개별 투영은 `*.projection.ts`이며 유스케이스가 호출하는 단계이지
  진입점이 아니다. `inbound/`가 이를 직접 참조하지 못한다.
- 타임라인·실행·레시피·규칙 투영이 형제 슬라이스로 갈라지지 않는다. 트랜잭션 경계가
  배치 하나이므로 한 몸으로 `project/` 안에 둔다.
- 죽었다 살아나도 마지막 적용 시퀀스에서 이어서 소비해야 하고, 중복 투영해서는 안 된다.
- 읽기 모델을 통째로 재생성하려면 `npm run projection:rebuild -- --confirm`을 쓴다.
  이 스크립트가 지우는 테이블 화이트리스트는 `@monitor/tracer-domain`의
  `persistence/projection.tables.ts`가 소유하므로 새 투영 테이블을 추가하면 그쪽도 갱신한다.

## 검증

```bash
npx vitest run packages/server/apps/projector && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
