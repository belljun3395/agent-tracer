# Agent Tracer - Runtime Capabilities

`packages/core/src/runtime-capabilities.ts` 는 런타임 어댑터별 관찰 가능 범위와
세션 종료 정책을 정의하는 단일 source-of-truth 입니다. 아래 표는 현재 코드의
값을 그대로 요약한 것입니다.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-hook` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |
| `codex-skill` | Yes (manual MCP) | No automatic observation | No automatic observation | `.agents/skills` | No | `never` |
| `opencode-plugin` | Yes (`chat.message`) | Yes | Yes | `.agents/skills`, `.claude/skills` | No | `primary-only` |
| `opencode-sse` | Yes | Yes | Yes | `.agents/skills`, `.claude/skills` | Yes | `primary-only` |

참고: 서버 API 스키마의 `runtimeSource`는 forward-compatibility를 위해 문자열(`z.string`)로 열려 있다.
위 표는 "현재 내장 capability registry에 등록된 adapter" 목록이다.

정책 요약:

- Claude hooks 는 raw prompt 를 캡처하지만 세션 종료 시 primary task 를 자동 완료하지 않는다.
- Codex CLI는 `codex-skill` + MCP를 캐노니컬 경로로 사용한다.
- `codex-skill`은 follow-up turn을 같은 task로 재사용하고, planning/context 같은 고수준 이벤트를 명시적으로 남긴다.
- Codex의 thread/topic 기준 최종 `assistant.response`는 `monitor_assistant_response` 경로를 사용한다.
- OpenCode plugin 은 typed hooks 와 `event` callback 을 함께 사용하지만, capability registry 에서는 별도 event-stream 경로가 아닌 `opencode-sse` 만 `hasEventStream: true` 로 본다.
- `opencode-sse` 는 capability registry 에 예약된 실험 어댑터이며, shadow observer wiring 이 필요할 때 확장한다.
