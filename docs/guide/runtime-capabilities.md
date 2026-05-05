# Agent Tracer - Runtime Capabilities

`packages/web/src/types/runtime-capabilities.defaults.ts` is the built-in
capability registry for the dashboard. The table below summarizes the current
code values as-is.

| Adapter | Raw user prompt | Tool calls | Subagents/background | Native skill paths | Separate event stream | Session close policy |
|---------|-----------------|------------|----------------------|--------------------|----------------------|----------------------|
| `claude-plugin` | Yes (`UserPromptSubmit` + `UserPromptExpansion` for slash commands) | Yes (full PostToolUse matcher set incl. LSP, Monitor, BashOutput, KillShell, NotebookEdit, PowerShell, Cron, ToolSearch, ModeChange) | Yes (`Agent|Skill`) | `.claude/skills` | No | `never` |
| `codex-cli` | Yes (`UserPromptSubmit`) | Yes (`Bash` + `apply_patch|Edit|Write` + `mcp__.*` via PostToolUse hooks; web via rollout observer; cross-check merges hook ↔ rollout) | No | `.agents/skills` | Yes (`~/.codex/sessions`) | `primary-only` |

Note: The `runtimeSource` in the server API schema is open as a string (`z.string`) for forward-compatibility.
The table above is a list of "adapters currently registered in the built-in capability registry."

Policy summary:

- Claude plugin captures raw prompts (and slash-command expansion) but does
  not auto-complete the primary task on session closure.
- Codex CLI hook mode captures the normal interactive `codex` path. Bash,
  `apply_patch` (alias `Edit` / `Write`), MCP, and `PermissionRequest`
  arrive through PostToolUse hooks; web search and token/rate-limit
  telemetry continue to come from the rollout observer. `apply_patch` and
  MCP are emitted by both the hook and the rollout observer; the server
  merges the two via `crossCheck.dedupeKey`.
- The `claude-hook` string remains only as a legacy data-compatibility alias; the canonical runtimeSource in docs and new events is `claude-plugin`.
- Manual HTTP/MCP clients are not registered as built-in adapters in the capability registry, but the server API itself can be used as-is.

## Privacy contract

Both adapters capture **action-side data only**. Every PostToolUse handler
ignores `tool_response`; the Codex rollout observer parses
`apply_patch.input` solely to extract touched file paths from the patch
headers. No stdout, stderr, file content, web response body, MCP result,
search result list, or grep snippet is ever stored — only the agent's
inputs (commands, queries, prompts, paths, glob filters, domain
allowlists, etc.) and quantitative wrappers like `commandAnalysis`. This
makes the tracer safe to deploy in shared environments where leaking user
code or files would be unacceptable.

## Hook Event Coverage

| Runtime | Official hook events | Handled | Payload readers |
|---------|----------------------|---------|-----------------|
| Claude plugin | 28 | 27 (see [hook-payload-spec.md](./hook-payload-spec.md)) | `packages/runtime/src/shared/hooks/claude/payloads.ts` |
| Codex CLI | 6 | 6 (full surface: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `Stop`) | `packages/runtime/src/shared/hooks/codex/payloads.ts` |

Claude events not yet handled by the plugin: `TeammateIdle` (experimental
agent teams), `Elicitation`, `ElicitationResult` (MCP form input).

Newly added Claude events (relative to v0.3 baseline): `UserPromptExpansion`,
`PermissionRequest`, `FileChanged`, `WorktreeCreate`, `WorktreeRemove`,
`Setup`. Newly added PostToolUse matchers: `LSP`, `Monitor`, `BashOutput`,
`KillShell`, `NotebookEdit`, `PowerShell`, `CronCreate|Delete|List`,
`EnterPlanMode|EnterWorktree|ExitWorktree`, `ToolSearch`. Codex side adds
direct `apply_patch` and `mcp__.*` PostToolUse handlers plus
`PermissionRequest` registration.

All handled events go through the shared
`runHook(name, { logger, parse, handler })` wrapper at
`packages/runtime/src/shared/hook-runtime/`, which swallows validation and
handler errors so runtime hooks never block Claude Code / Codex on plugin
failures. Payload readers surface the full official field surface
(including `model`, `permission_mode`, `transcript_path`, `cwd` for Claude;
`model`, `turn_id`, `cwd`, `transcript_path` for Codex).

## Async hook policy

Stateless event-emitting hooks (most of `PostToolUse*`, `Stop*`,
`SessionEnd`, `Notification`, `SubagentStop`, `TaskCreated/Completed`,
`ConfigChange`, `CwdChanged`, `FileChanged`, `Pre/PostCompact`,
`PermissionDenied`, `WorktreeRemove`, `UserPromptExpansion`,
`InstructionsLoaded`, `PostToolBatch`) are registered with `"async": true`
so they fire-and-forget. Sync handlers are kept on the critical path only
when sequencing matters: `PreToolUse`, `SessionStart`, `Setup`,
`UserPromptSubmit`, `SubagentStart`, `PermissionRequest`, `WorktreeCreate`.
