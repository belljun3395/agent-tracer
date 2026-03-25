# Runtime Capabilities Registry

runtime capability registry는 "각 런타임이 무엇을 관찰할 수 있고,
세션 종료 시 어떤 lifecycle 정책을 가져야 하는가"를 코드로 고정한 표다.
문서보다 먼저 확인해야 하는 실제 source of truth는
`packages/core/src/runtime-capabilities.ts`다.

## 핵심 파일

- `packages/core/src/runtime-capabilities.ts`
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`

## 현재 등록된 adapter

| Adapter | Raw prompt | Tool calls | Subagents | Native skill discovery | Event stream | Session close policy |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-hook` | Yes | Yes | Yes | `.claude/skills` | No | `never` |
| `codex-skill` | Yes, but manual | No automatic observation | No automatic observation | `.agents/skills` | No | `never` |
| `opencode-plugin` | Yes | Yes | Yes | `.agents/skills`, `.claude/skills` | No | `primary-only` |
| `opencode-sse` | Yes | Yes | Yes | `.agents/skills`, `.claude/skills` | Yes | `primary-only` |

## capability가 필요한 이유

런타임마다 할 수 있는 일이 다르기 때문이다.

- Claude hook은 raw prompt와 tool use를 자동으로 볼 수 있다.
- Codex는 skill + MCP 조합이라 자동 hook 수준 관찰은 없다.
- OpenCode는 plugin hook과 typed event callback을 통해 assistant-side signal을 비교적 풍부하게 다룰 수 있다.

이 차이를 capability registry로 명시해 두면,
server lifecycle policy와 guide 문서가 같은 기대를 공유할 수 있다.

## 각 필드의 의미

### `canCaptureRawUserMessage`

실제 사용자 프롬프트를 canonical `user.message`로 남길 수 있는지 나타낸다.

### `canObserveToolCalls`

파일 읽기, 편집, bash, MCP call 같은 구현 행위를 자동으로 감지할 수 있는지 나타낸다.

### `canObserveSubagents`

background task, delegation, agent activity를 자동 추적할 수 있는지 나타낸다.

### `hasNativeSkillDiscovery`

런타임이 리포지토리 내부 skill 파일을 자체 discovery 경로에서 읽을 수 있는지 나타낸다.

### `hasEventStream`

OpenCode SSE처럼 assistant 응답 흐름이나 실시간 state stream을 별도로 구독할 수 있는지 나타낸다.

### `endTaskOnSessionClose`

세션 종료가 task 완료를 의미하는지, 아니면 follow-up을 위해 task를 열어 두는지 결정한다.
이 값은 `SessionLifecyclePolicy`와 runtime adapter 문서가 함께 참고한다.

## 운영 관점에서 중요한 포인트

- capability table은 "문서의 추천"이 아니라 "실제 지원 범위"를 적어야 한다.
- 신규 런타임을 추가할 때는 README보다 먼저 이 파일을 갱신해야 drift가 줄어든다.
- `docs/guide/runtime-capabilities.md`는 이 파일의 요약본이어야 한다.

## 새 adapter를 추가할 때 확인할 질문

1. raw user prompt를 진짜로 볼 수 있는가
2. tool call을 종류별로 구분할 수 있는가
3. subagent/background 작업을 parent lineage와 함께 추적할 수 있는가
4. session close 시 task를 닫아야 하는가, waiting으로 남겨야 하는가
5. skill file discovery path는 어디인가

## 관련 문서

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [Claude Code Hooks Adapter](./claude-code-hooks-adapter.md)
- [OpenCode Plugin Adapter](./opencode-plugin-adapter.md)
- [Codex Skill Adapter](./codex-skill-adapter.md)
