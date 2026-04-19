# Agent Tracer - Runtime Capabilities

`packages/domain/src/runtime/index.ts` is the single source of truth defining
observability scope and session closure policy per runtime adapter. The table below
summarizes the current code values as-is.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-plugin` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |

Note: The `runtimeSource` in the server API schema is open as a string (`z.string`) for forward-compatibility.
The table above is a list of "adapters currently registered in the built-in capability registry."

Policy summary:

- Claude plugin captures raw prompts but does not auto-complete the primary task on session closure.
- The `claude-hook` string remains only as a legacy data-compatibility alias; the canonical runtimeSource in docs and new events is `claude-plugin`.
- Manual HTTP/MCP clients are not registered as built-in adapters in the capability registry, but the server API itself can be used as-is.
