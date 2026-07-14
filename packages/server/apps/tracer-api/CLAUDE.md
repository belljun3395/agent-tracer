# packages/server/apps/tracer-api

읽기와 잡 등록과 실시간 전송이다. 읽기 모델(`@monitor/tracer-domain`)만 조회하고
원장을 직접 읽지 않는다.

## 슬라이스

`task` `timeline` `rule` `recipe` `job` `search` `settings` `user` `session` `cleanup`
`affinity` `health` 열두 개다. 각 슬라이스는
`{inbound,application,port,adapter,model}` 뼈대를 따르되 쓰는 계층만 둔다.

## 이 패키지만의 제약

- `job`이 `@monitor/platform`의 Temporal 클라이언트 포트로 AI 잡 워크플로를 등록한다.
  워크플로 실행 자체는 `ai-agent-worker`가 한다.
- 실시간 알림 발행/구독 배선(WS 브로드캐스터, 알림 컨슈머)은 특정 도메인이 소유하지 않는
  앱 전역 배선이라 `config/`에 있다.
- `rule`·`job`·`task`가 함께 쓰는 규칙 검증 로직은 공용 서비스로 끌어올리지 않고
  각 슬라이스가 자기 몫을 갖는다. 세 벌이 갈라져도 도메인 간 중복은 이 저장소의
  정책상 허용이다.
- OpenSearch 클라이언트는 `search` 슬라이스의 `adapter/`가 감싸고, 연결 자체는
  `config/opensearch.client.const.ts`가 만든다.

## 검증

```bash
npx vitest run packages/server/apps/tracer-api && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
