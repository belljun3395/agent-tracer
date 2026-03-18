# Agent Tracer - Runtime Capabilities

`packages/core/src/runtime-capabilities.ts` 는 런타임 어댑터별 관찰 가능 범위와
세션 종료 정책을 정의하는 단일 source-of-truth 입니다.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|-------------|----------------------|
| `claude-hook` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |
| `codex-skill` | Yes (manual MCP) | No automatic observation | No automatic observation | `.agents/skills` | No | `never` |
| `opencode-plugin` | Yes (typed `chat.message` hook) | Yes | Yes | `.agents/skills`, `.claude/skills` | Yes (`session.*`, `message.updated`, `command.executed`, `tui.command.execute`, typed `server.instance.disposed`) | `primary-only` |
| `opencode-sse` | Reserved experimental adapter | Planned | Planned | `.agents/skills`, `.claude/skills` | Yes | `primary-only` |

정책 요약:

- Claude hooks 는 raw prompt 를 캡처하지만 세션 종료 시 primary task 를 자동 완료하지 않는다.
- Codex 는 explicit skill + MCP 경로라서 native hook 수준의 자동 관찰은 없다.
- OpenCode plugin 은 typed direct hooks 와 event stream 을 함께 사용해 raw prompt, tool calls, background linkage 를 관찰한다.
- OpenCode docs page의 event 표에 없는 typed hook/event (`chat.message`, `command.execute.before`, `server.instance.disposed`) 도 현재 plugin/sdk surface 에 존재한다.
- `opencode-sse` 는 capability registry 에 예약된 실험 어댑터이며, shadow observer wiring 이 필요할 때 확장한다.
