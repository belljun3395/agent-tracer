# packages/server/apps/ai-agent-worker

AI 잡(레시피 스캔·제목 제안·태스크 정리)의 오케스트레이션이다. Temporal 워크플로가
재시도와 시간 초과와 취소를 소유한다.

## 슬라이스

`recipe` `title` `cleanup` 셋이다. 각 슬라이스는 이렇게 생겼다.

```
recipe/
  inbound/     recipe.workflow.ts   recipe.activity.ts
  application/ scan.recipe.usecase.ts
  port/        recipe.agent.port.ts   recipe.repository.port.ts
  adapter/     recipe.sdk.agent.adapter.ts   recipe.graph.agent.adapter.ts
  model/       recipe.spec.ts   task.summary.model.ts
```

## 이 패키지만의 제약

- 백엔드는 둘뿐이다. `*.sdk.agent.adapter.ts`(Claude SDK)와 `*.graph.agent.adapter.ts`
  (Python `packages/agents` 실행 백엔드를 HTTP로 호출).
- SDK 백엔드만 `*.tools.ts`의 도구 핸들러를 프로세스 안에서 실행한다. graph 백엔드는 자기
  도구를 스스로 실행하므로 워커는 실행 봉투와 사전 필터 결과만 넘기고 결과의 taskId 소유권만
  다시 본다. `@monitor/llm-runtime`의 `agent.completion.server.ts`는 완료 통지만 받는다.
- 프롬프트와 출력 스키마와 도구 명세는 제품 지식이므로 슬라이스의 `model/`이 소유한다.
  두 어댑터가 같은 명세를 읽어 서로 다른 방언으로 렌더링한다.
- `*.workflow.ts`는 결정적이어야 한다. `*.activity.ts`, `adapter/`, `port/`, `config/`,
  Node API를 import하지 못한다. 이것은 Temporal의 외부 제약이다.
- 언어 모델 공급자 실행기는 `packages/server/libs/llm-runtime`(`@monitor/llm-runtime`)에 있다.
  도메인 어휘를 모르고 프롬프트를 받아 구조화된 출력만 낸다. 슬라이스의 어댑터가 이 실행기와
  자기 명세를 조합한다.
- 두 슬라이스가 이벤트 조회 도구를 각자 갖는다. 공용 도구로 묶지 않는다.

## 검증

```bash
npx vitest run packages/server/apps/ai-agent-worker && npm run lint:deps
```

워크플로 결정성은 테스트가 잡지 못하므로 `*.workflow.ts`를 바꾸면 import 목록을 직접
확인한다. 전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
