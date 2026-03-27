# Agent Tracer - Runtime Capabilities

`packages/core/src/runtime-capabilities.ts` 는 런타임 어댑터별 관찰 가능 범위와
세션 종료 정책을 정의하는 단일 source-of-truth 입니다. 아래 표는 현재 코드의
값을 그대로 요약한 것입니다.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-hook` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |
| `codex-hook` | Yes (`UserPromptSubmit`, transcript fallback) | Yes (`Bash`, transcript backfill) | No | None | No | `always` |
| `codex-skill` | Yes (manual MCP) | No automatic observation | No automatic observation | `.agents/skills` | No | `never` |
| `opencode-plugin` | Yes (`chat.message`) | Yes | Yes | `.agents/skills`, `.claude/skills` | No | `primary-only` |
| `opencode-sse` | Yes | Yes | Yes | `.agents/skills`, `.claude/skills` | Yes | `primary-only` |

정책 요약:

- Claude hooks 는 raw prompt 를 캡처하지만 세션 종료 시 primary task 를 자동 완료하지 않는다.
- Codex CLI 는 현재 `codex-hook` 과 `codex-skill` 두 경로로 나뉜다.
- `codex-hook` 는 자동 prompt/Bash/transcript backfill 을 제공하지만, native skill discovery 는 없고 기본 정책도 turn 단위 완료다.
- `codex-skill` 은 follow-up turn 을 같은 task 로 재사용하고, planning/context 같은 고수준 이벤트를 명시적으로 남기는 경로다.
- Codex 의 thread/topic 기준 최종 `assistant.response` 경로는 여전히 `codex-skill` 쪽 `monitor_assistant_response`를 기준으로 보는 편이 안전하다.
- OpenCode plugin 은 typed hooks 와 `event` callback 을 함께 사용하지만, capability registry 에서는 별도 event-stream 경로가 아닌 `opencode-sse` 만 `hasEventStream: true` 로 본다.
- `opencode-sse` 는 capability registry 에 예약된 실험 어댑터이며, shadow observer wiring 이 필요할 때 확장한다.
