# packages/runtime

에이전트 쪽 수집기 플러그인과 로컬 데몬이다. 배포되는 장수 프로세스라 훅 호출마다
버전을 확인하고 필요하면 스스로 재기동한다.

## 슬라이스

`src/domain/{slice}/{inbound,application,port,adapter,model}` 뼈대를 따른다.

- `ingest`: 도구 호출을 이벤트로 조형한다. 절단 상한, 도구 응답 캡처, 파일 타깃 수집,
  제목과 본문 파생이 전부 여기 `model/`에 있다.
- `guardrail`: 턴이 끝나기 전에 규칙 이행 여부를 판정하고 미이행이면 턴을 붙잡는다.
- `recipe` `hint`: 레시피 매칭과 컨텍스트 주입 텍스트 조립.
- `rulegen`: 규칙 생성 프롬프트 명세와 도구 명세.
- `binding` `session` `turn`: 이벤트와 세션·턴의 의미 추론.

## 어댑터와 데몬

- `agent/claude-code/`: 훅 엔트리와 페이로드 리더. 와이어 포맷만 알고 도메인의
  응용 계층만 부른다. 도구 호출을 어떤 이벤트로 만들지는 어댑터가 아니라
  `domain/ingest/model/`이 정한다.
- `agent/claude-code/mcp/`: Claude Code가 세션마다 띄우는 stdio MCP 서버. JSON-RPC
  줄바꿈 프레이밍(`rpc.ts`)과 도구 디스패치(`tool.dispatch.ts`)만 알고, 실제 처리는
  전부 데몬 소켓으로 위임한다. 훅과 마찬가지로 얇은 어댑터이며 의존 없이 직접
  구현했다 — 프로토콜이 `initialize`·`tools/list`·`tools/call` 세 메서드뿐이라
  SDK를 들이는 비용이 자립 번들 원칙에 비해 더 크다.
- `daemon/`: 조립 근원과 제어 화면. `daemon/port/`가 훅과 데몬 사이 소켓 계약을
  단독 소유하고 클라이언트와 서버가 같은 타입을 쓴다. `daemon/port/mcp.socket.port.ts`가
  MCP 브리지 전용 메시지(레시피 검색·성과 보고·스캔 요청·제목 갱신)를 얹어 쓰며
  `daemon.socket.port.ts`의 `parseDaemonRequest`가 못 찾은 타입을 이쪽에 넘긴다.

MCP 도구가 묻는 "지금 태스크가 뭔가"는 훅과 달리 답이 없다 — Claude Code는 MCP 서버
호출에 세션 식별자를 싣지 않는다. 데몬은 바인딩 저장소에서 턴이 가장 최근에 열린
바인딩을 그 태스크로 추정한다(`domain/binding/application/find.active.binding.usecase.ts`).
같은 워크스페이스에 세션이 여럿 활성 상태면 엉뚱한 태스크를 짚을 수 있고, 그 한계는
`set_task_title` 도구 설명에 그대로 적어 에이전트가 알게 한다.

훅과 데몬은 별개 프로세스이므로 서버를 부를 신원과 주소를 각자 해석하면 갈라진다.
`config/monitor.identity.ts`가 그 해석을 단독 소유하고 두 프로세스가 그것만 부른다.
값은 `~/.agent-tracer/config.json`의 `userId`와 `baseUrl`이며 환경변수가 파일을 이긴다.

폴링 주기·idle 종료·스풀 상한 같은 운영 튜닝값 9개는 같은 파일의 `daemon` 키에 산다
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
  설명 문구에 언제 불러야 하는지를 못박는 것이 그 자체로 설계물이다 — 프롬프트 주입이
  아니라 에이전트가 설명만 보고 스스로 판단해 부르는 통로이기 때문이다.

## 검증

```bash
npx vitest run packages/runtime && npm run lint:deps
```

전체 게이트는 `npm run lint && npm run test && npm run lint:deps`다.
