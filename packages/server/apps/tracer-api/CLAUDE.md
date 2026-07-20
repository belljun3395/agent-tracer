# packages/server/apps/tracer-api

읽기와 잡 등록과 실시간 전송이다. 읽기 모델(`@monitor/tracer-domain`)만 조회하고
원장을 직접 읽지 않는다.

## 슬라이스

`task` `timeline` `rule` `recipe` `job` `search` `settings` `user` `session` `cleanup`
`health` `memo` `tag` 열세 개다. 각 슬라이스는
`{inbound,application,port,adapter,model}` 뼈대를 따르되 쓰는 계층만 둔다.

| 슬라이스 | 노출하는 경로 |
|---|---|
| `task` | `/api/v1/tasks`, `/api/v1/tasks/:taskId`(+`children` `turns` `user-inputs` `archive` `openinference`) |
| `timeline` | `/api/v1/tasks/:taskId/timeline`, `/api/v1/tasks/:taskId/verifications` |
| `rule` | `/api/v1/rules`(+`:id` `approve` `reevaluate` `nudge` `:ruleId/evidence`) |
| `recipe` | `/api/v1/recipes`(+`applications` `:id` `accept` `dismiss` `outcome` `retire`) |
| `job` | `/api/v1/jobs`(+`history` `latest` `:id` `steps` `cancel` `start` `lease` `release` `results` `fail`) |
| `search` | `/api/v1/tasks/search`, `/api/v1/events/search` |
| `memo` | `/api/v1/memos`, `/api/v1/memos/:id` |
| `tag` | `/api/v1/tags`, `/api/v1/tags/:id`, `/api/v1/task-tags` |
| `cleanup` | `/api/v1/task-cleanup/suggestions`(+`accept` `dismiss`) |
| `settings` | `/api/v1/settings`, `/api/v1/settings/:key` |
| `user` | `/api/v1/users/me`, `/api/v1/users/onboarding` |
| `session` | `/api/v1/session`, WebSocket `/ws` |
| `health` | `/health`, `/health/ready`, `/api/v1/daemon-health` |

메모·규칙·태그처럼 다른 배포 단위가 함께 부르는 경로는 커널의 상수가 소유한다.

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
