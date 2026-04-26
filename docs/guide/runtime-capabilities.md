# Agent Tracer - Runtime Capabilities

`packages/web/src/types/runtime-capabilities.defaults.ts` is the built-in
capability registry for the dashboard. The table below summarizes the current
code values as-is.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-plugin` | Yes (`UserPromptSubmit`) | Yes | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |
| `codex-cli` | Yes (`UserPromptSubmit`) | Yes (`Bash`, rollout `apply_patch`, MCP, web) | No | `.agents/skills` | Yes (`~/.codex/sessions`) | `primary-only` |

Note: The `runtimeSource` in the server API schema is open as a string (`z.string`) for forward-compatibility.
The table above is a list of "adapters currently registered in the built-in capability registry."

Policy summary:

- Claude plugin captures raw prompts but does not auto-complete the primary task on session closure.
- Codex CLI hook mode captures the normal interactive `codex` path. Bash comes from
  hooks; apply_patch, MCP calls, and web search/fetch come from the rollout observer.
- The `claude-hook` string remains only as a legacy data-compatibility alias; the canonical runtimeSource in docs and new events is `claude-plugin`.
- Manual HTTP/MCP clients are not registered as built-in adapters in the capability registry, but the server API itself can be used as-is.

## Hook Event Coverage (v0.3)

| Runtime | Official hook events | Handled | Payload readers |
|---------|----------------------|---------|-----------------|
| Claude plugin | 28 | 21 (see [hook-payload-spec.md](./hook-payload-spec.md)) | `packages/runtime/src/shared/hooks/claude/payloads.ts` |
| Codex CLI | 6 | 5 registered by default; `PermissionRequest` implemented but optional | `packages/runtime/src/shared/hooks/codex/payloads.ts` |

Claude events not yet handled by the plugin: `UserPromptExpansion`,
`PermissionRequest`, `TeammateIdle`, `FileChanged`, `WorktreeCreate`,
`WorktreeRemove`, `Elicitation`, `ElicitationResult`.

All handled events go through the shared
`runHook(name, { logger, parse, handler })` wrapper at
`packages/runtime/src/shared/hook-runtime/`, which swallows validation and
handler errors so runtime hooks never block Claude Code / Codex on plugin
failures. Payload readers surface the full official field surface
(including `model`, `permission_mode`, `transcript_path`, `cwd` for Claude;
`model`, `turn_id`, `cwd`, `transcript_path` for Codex).
