# Agent Tracer Runtime — Codex Adapter

This document describes the Codex runtime adapter implemented in `packages/runtime/src/codex`.

The current adapter is intentionally limited to **officially documented Codex hook surfaces** as of **April 20, 2026**:

- Codex `hooks` (`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`)

The adapter does **not** try to mirror Claude Code's richer hook surface. Codex does not currently expose equivalent official hooks for instruction loads, compaction lifecycle, or non-Bash tool post-processing.

## Supported inputs

### Codex hooks

The hook templates live under:

- `src/codex/hooks/hooks.json`
- `src/codex/bin/run-hook.sh`

The current hook adapter only covers what Codex officially supports today:

- `SessionStart`
- `UserPromptSubmit`
- `PreToolUse` (`Bash` only)
- `PostToolUse` (`Bash` only)
- `Stop`

## Claude 대비 대응 범위

| 범주 | Claude Code adapter | Codex adapter 현재 상태 |
| --- | --- | --- |
| Session start | 지원 | 지원 |
| User prompt capture | 지원 | 지원 |
| Bash command capture | 지원 | 지원 |
| File tool capture | 지원 | 미지원 |
| MCP tool capture | 지원 | 미지원 |
| Web tool capture | 지원 | 미지원 |
| Instructions lifecycle | 지원 | 미지원 |
| Compact lifecycle | 지원 | 미지원 |
| Subagent lifecycle | 지원 | 미지원 |

Current Codex support is intentionally narrower. The follow-up expansion path is Codex app-server JSON-RPC, not a wider hook surface.

## Event mapping

### Hooks -> shared events

| Codex hook | Shared event | Notes |
| --- | --- | --- |
| `SessionStart` | `context.saved` | `startup` / `resume` only |
| `UserPromptSubmit` | `user.message` | Uses `taskCreated` to infer `initial` vs `follow_up` |
| `PreToolUse` | none | Only ensures the runtime session exists |
| `PostToolUse` (`Bash`) | `terminal.command` | Bash only; no file/MCP/web parity |
| `Stop` | `assistant.response` | Uses `last_assistant_message` |

## Current limitations

These are deliberate v1 limitations:

- No `SessionEnd` hook mapping. Codex does not currently document a dedicated session-end hook surface.
- No parity with Claude-specific hooks such as `InstructionsLoaded`, `PreCompact`, `PostCompact`, or subagent lifecycle hooks.
- No hook-time interception for MCP, file changes, or web tools. Codex currently documents Bash-only tool hooks.
- No app-server integration yet.
- No synthetic parent/child task model for Codex subagents in v1.

## Files

- `src/codex/lib/transport/transport.ts`
- `src/codex/hooks/*.ts`
- `src/codex/hooks/hooks.json`
- `src/codex/bin/run-hook.sh`

## Verification

Type and path alias integrity are validated through the package typecheck:

```bash
npm --prefix packages/runtime run lint:types
```
