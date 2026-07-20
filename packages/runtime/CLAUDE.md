# packages/runtime

에이전트 쪽 수집기 플러그인과 로컬 데몬이다. 배포되는 장수 프로세스라 훅 호출마다
버전을 확인하고 필요하면 스스로 재기동한다.

## 슬라이스

`src/domain/{slice}/{inbound,application,port,adapter,model}` 뼈대를 따른다.

- `ingest`: 도구 호출을 이벤트로 조형한다. 절단 상한, 도구 응답 캡처, 파일 타깃 수집,
  제목과 본문 파생이 전부 여기 `model/`에 있다.
- `guardrail`: 턴이 끝나기 전에 규칙 이행 여부를 판정하고 미이행이면 턴을 붙잡는다.
- `recipe` `hint`: 레시피 저장소가 있다는 사실만 알리는 고정 넛지와 본문 조립, 컨텍스트 주입
  텍스트 조립. 넛지는 상태 없는 고정 문구이므로 `model/recipe.nudge.model.ts`를 훅이 직접
  부른다. 레시피 목록은 프롬프트에 싣지 않는다 — 관련성 판단은 에이전트가 `search_recipes`로
  질의어를 던져 얻은 결정 수준 정보(제목·의도·설명·점수)로 내리고, 적용할 레시피 전체 본문은
  `get_recipe`가 그때마다 서버에서 직접 가져온다.
- `rulegen`: 규칙 생성 프롬프트 명세와 도구 명세.
- `binding` `session` `turn`: 이벤트와 세션·턴의 의미 추론.
- `memo`: 에이전트가 스스로 남기는 메모의 쓰기·조회 도구다.

## 어댑터와 데몬

- `agent/claude-code/`: 훅 엔트리와 페이로드 리더. 와이어 포맷만 알고 도메인의
  응용 계층만 부른다. 도구 호출을 어떤 이벤트로 만들지는 어댑터가 아니라
  `domain/ingest/model/`이 정한다.
- `agent/claude-code/mcp/`: Claude Code가 세션마다 띄우는 stdio MCP 서버. JSON-RPC
  줄바꿈 프레이밍(`rpc.ts`)과 도구 디스패치(`tool.dispatch.ts`)만 알고, `composition.ts`가
  조립한 유스케이스로 서버를 직접 부른다. 훅과 마찬가지로 얇은 어댑터이며 의존 없이 직접
  구현했다 — 프로토콜이 `initialize`·`tools/list`·`tools/call` 세 메서드뿐이라 SDK를
  들이는 비용이 자립 번들 원칙에 비해 더 크다. `get_recipe`는 레시피 본문을 가져온 뒤
  `recipeInjected` 이벤트를 훅과 같은 방식으로 스풀에 직접 남겨 적용 이력을 연다.
  `set_task_title`만 예외로 데몬 소켓을 거친다.
- `daemon/`: 조립 근원과 제어 화면. `daemon/port/`가 훅과 데몬 사이 소켓 계약을
  단독 소유하고 클라이언트와 서버가 같은 타입을 쓴다. `daemon/port/mcp.socket.port.ts`는
  `set_task_title` 재제목 메시지 하나만 얹으며, `daemon.socket.port.ts`의
  `parseDaemonRequest`가 못 찾은 타입을 이쪽에 넘긴다.

`set_task_title`이 데몬 소켓을 거치는 이유는 원장 순서 때문이다. 한 태스크의 첫 발화에서
`EnsureSessionUsecase`가 조악한 초기 제목으로 `taskLinked` 이벤트를 스풀에 큐잉하고, 그
즉시 같은 턴 안에서 에이전트에게 `set_task_title`을 지금 부르라는 넛지가 간다. 그 스풀
이벤트가 아직 서버에 배출되기 전에 `set_task_title`이 읽기 모델을 직접 덮어쓰면, 나중에
배출된 `taskLinked`가 순서 없이 다시 덮어써 에이전트가 지은 제목을 지울 수 있다 — 투영이
`title`을 무조건 마지막 쓰기로 덮기 때문이다. 데몬 소켓 경로는 이 순서 위험을 만들지 않는
유일한 경로다.

MCP 도구가 묻는 "지금 태스크가 뭔가"는 추정하지 않는다. Claude Code가 세션마다 띄우는
MCP 서버 프로세스의 환경변수 `CLAUDE_CODE_SESSION_ID`에 그 서버가 딸린 세션의 식별자가
들어 있고(`config/env.ts`의 `resolveClaudeSessionId`), MCP 프로세스가 그것으로
`~/.agent-tracer/bindings.json`을 스스로 읽어 바인딩을 찾는다(`resolveLiveBinding`,
`/clear` 승계까지 따라간다). 못 찾으면 `unknown_session`으로 실패하고 가장 최근
바인딩으로 물러서지 않는다 — 조용히 틀린 태스크에 쓰는 것이 가장 나쁜 결과이기 때문이다.

`search_recipes`는 태스크에 귀속되지 않는 유일한 조회 도구라 세션 식별이 필요 없다.

서브에이전트는 부모와 같은 MCP 서버 프로세스를 쓰므로 자기 자신을 식별할 통로가 없다.
그래서 서브에이전트가 부른 도구는 자기 태스크가 아니라 자기를 띄운 세션의 태스크에
붙으며, 그 사실을 도구 설명에 그대로 적어 에이전트가 알게 한다.

훅과 데몬은 별개 프로세스이므로 서버를 부를 신원과 주소를 각자 해석하면 갈라진다.
`config/monitor.identity.ts`가 그 해석을 단독 소유하고 두 프로세스가 그것만 부른다.
값은 `~/.agent-tracer/config.json`의 `userId`와 `baseUrl`이며 환경변수가 파일을 이긴다.

폴링 주기·idle 종료·스풀 상한 같은 운영 튜닝값 8개는 같은 파일의 `daemon` 키에 산다
(`config/daemon.settings.ts`). 데몬은 부팅 시 한 번만 해석해 그 값으로 돌고, 저장은
제어 화면의 Settings 탭이 파일만 바꾼다 — 적용은 데몬 재기동으로 한다.

## 플러그인 패키징

이 디렉터리가 곧 플러그인 루트다. `.claude-plugin/plugin.json`이 배포 버전을 소유하고,
`hooks/hooks.json`이 모든 훅 이벤트를 `bin/run-hook-claude.sh` 하나로 모으며, 같은
매니페스트의 `mcpServers`가 MCP 서버를 `bin/run-mcp-server.sh`로 띄운다. 훅 이름은
`src/agent/claude-code/hooks/`의 파일 이름과 같다.

```bash
npm run build --workspace @monitor/runtime
```

`dist/agent/claude-code/hooks/<훅이름>.js`, `dist/agent/claude-code/mcp/server.js`,
`dist/daemon/main.js`가 나오며 셋 다 커널까지 인라인한 단일 파일이다. 진입 스크립트는
번들이 있으면 node로 실행하고 없으면 소스를 로더로 띄운다. 설치본에는 `node_modules`가
없으므로 번들을 빼고 배포하면 훅과 MCP 서버가 죽는다. 자세한 사용법은 README.md에 있다.

## 이 패키지만의 제약

- 훅과 MCP 서버 번들은 자립해야 한다. `@monitor/kernel`의 `*.schema.ts`를 값으로
  import하지 못하고 타입으로만 쓴다. zod 인스턴스를 그 프로세스들에 실어 보내지 않는다.
- 어댑터가 하나(Claude Code)뿐이어도 `agent/` 경계는 유지한다. 와이어 파싱과 제품 규칙이
  섞이면 두 번째 런타임을 붙일 때 다시 갈라야 한다.
- 데몬은 재기동해도 스풀과 데드레터를 잃지 않아야 한다. 소켓 계약을 바꾸면 클라이언트와
  서버 타입을 함께 고친다.
- MCP 도구의 이름·설명·입력 스키마는 제품 지식이므로 도메인 `model/`이 소유한다
  (레시피 도구는 `domain/recipe/model/`, 제목 도구는 `domain/session/model/`). 도구
  설명 문구는 무엇을 하는 도구이고 부를지 말지를 어떻게 판단하는지를 못박는다 —
  판단 기준 자체가 설계물이기 때문이다.
- 부를 시점("언제")은 판단 기준과 다른 문제라 설명 문구만으로는 유발되지 않는다
  — 관측용 도구가 실측에서 거의 자발 호출되지 않았다. 그래서 훅이 `emitAgentContext`의
  additionalContext로 시점 넛지를 주입해 유발한다. 넛지 문구도 제품 지식이므로 도메인
  `model/`이 소유한다(제목 넛지는 `domain/session/model/task.title.nudge.model.ts`).

## 검증

```bash
npx vitest run packages/runtime && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
