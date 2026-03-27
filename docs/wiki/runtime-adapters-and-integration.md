# Runtime Adapters & Integration

Agent Tracer의 큰 장점은 특정 에이전트 하나에 묶이지 않는다는 점이다.
다만 이 추상화는 "다 똑같이 기록한다"가 아니라, 각 런타임의 capability 차이를
명시적으로 인정하면서 공통 task/session/event 모델로 수렴시키는 방식으로 구현돼 있다.

## 현재 지원하는 통합 방식

| 방식 | 대표 런타임 | 특징 |
| --- | --- | --- |
| hook | Claude Code, Codex(부분) | runtime lifecycle을 자동으로 따라가며 이벤트를 관찰 (Codex는 transcript 백필 기반으로 부분 자동화) |
| plugin | OpenCode | typed hook + event callback을 함께 써서 richer signal을 얻기 좋음 |
| skill + MCP | Codex | 수동 기록 경로가 가장 명시적이고 통제 가능하며, hook의 빈 구간을 보완 |

## 핵심 파일

- `packages/core/src/runtime-capabilities.ts`
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`
- `skills/codex-monitor/SKILL.md`
- `.claude/hooks/*`
- `.opencode/plugins/monitor.ts`

## 공통 설계 원칙

### capability로 차이를 먼저 선언한다

raw user prompt를 볼 수 있는지, tool call을 자동 관찰할 수 있는지,
session close가 task complete를 의미하는지는 런타임마다 다르다.
이 차이는 `runtime-capabilities.ts`에서 먼저 고정한다.

### 서버 API는 가능한 공통 surface를 유지한다

runtime이 달라도 서버에는 가급적 같은 개념으로 들어오게 한다.
예를 들어 모두 `user.message`, `assistant.response`, `task.start` 같은 canonical event를
만들도록 유도한다.

### lifecycle helper는 두 계열로 나뉜다

- hook/skill처럼 안정적인 런타임 session ID가 있는 경로: `runtime-session-ensure/end`
- plugin처럼 task row를 명시적으로 만들고 관리하는 경로: `task-start`, `session-end`, `task-complete`

## 최근 코드 기준 포인트

### Claude는 Stop 훅에서 assistant response와 complete를 함께 처리한다

이제 Claude 쪽은 `stop.ts`가 `/api/assistant-response`와
`/api/runtime-session-end { completeTask: true }`를 함께 호출한다.

### OpenCode는 workflow library UI와 잘 연결되는 read path를 쓴다

OpenCode plugin이 task를 만들고 나면, 웹은 `/api/workflows`와 typed realtime message를 통해
workflow panel과 overview를 갱신할 수 있다.

### Codex는 hook + skill 하이브리드 경로다

Codex hook은 `UserPromptSubmit`/`PostToolUse(Bash)`/`Stop`에서 기본 이벤트를 자동으로 기록한다.
특히 `Stop`에서 transcript를 읽어 `web_search_end`, `apply_patch`를 backfill한다.

다만 assistant 응답/고수준 계획 컨텍스트는 여전히 skill 경로가 더 풍부하므로,
`monitor_assistant_response` 같은 MCP 호출 지침이 함께 중요하다.

## 새 런타임을 추가할 때 체크리스트

1. raw prompt를 캡처할 수 있는가
2. tool call을 종류별로 관찰할 수 있는가
3. background/subagent를 추적할 수 있는가
4. session close가 waiting인지 complete인지 정의할 수 있는가
5. skill/hook/plugin discovery 경로는 어디인가
6. 어떤 HTTP endpoint를 최소 구현으로 볼 것인가

## 관련 문서

- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Claude Code Hooks Adapter](./claude-code-hooks-adapter.md)
- [OpenCode Plugin Adapter](./opencode-plugin-adapter.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
