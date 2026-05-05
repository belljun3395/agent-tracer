# Agent Tracer - API Integration Map

This is a reference organizing API endpoint usage per runtime.
The automatic adapters currently implemented in the repository are the Claude Code
plugin and the Codex hook adapter; other runtimes can be attached by calling the
same API directly.

Implementation basis:
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude plugin implementation: `packages/runtime/src/claude-code/hooks/*.ts`
- Codex hook adapter: `packages/runtime/src/codex/hooks/*.ts`

Related documentation:
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md)
- [Runtime capabilities](./runtime-capabilities.md)

## Session Lifecycle

| API | Role | Automatic adapters | Manual runtime |
|-----|------|--------------------|-----------------|
| `/ingest/v1/sessions/ensure` | Runtime session upsert | `SessionStart`, `UserPromptSubmit`, `PreToolUse`, subagent hooks | Use if stable runtime session ID is available |
| `/ingest/v1/tasks/start` | Explicit task/session creation | Rarely used | Use when no session ID-based binding |
| `/ingest/v1/sessions/end` | Runtime session closure | `Stop`, `SessionEnd`, `SubagentStop`, Codex `Stop` | Use to separate turn end from task end; pass `completeTask: true` only for a completed work item |
| `/ingest/v1/tasks/complete` | Explicit task completion | Not called directly | Use when directly completing a known task; accepts task fields only, not runtime-session closure fields |
| `/ingest/v1/tasks/error` | Explicit task failure | Not called directly | Use when directly marking a known task as errored |
| `/ingest/v1/conversation` (`assistant.response`) | Record assistant turn result | `Stop`, `StopFailure` | Send an `assistant.response` event if assistant has final text |

`/ingest/v1/tasks/complete` and `/ingest/v1/tasks/error` finalize a task by `taskId`.
Runtime-session policy fields such as `completeTask`, `completionReason`, and
`backgroundCompletions` belong to `/ingest/v1/sessions/end`, where the server
can decide whether ending a runtime observation window should also finalize the
bound task.

## Messages/Context

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/ingest/v1/conversation` | Record user input | `UserPromptSubmit` | Required |
| `/ingest/v1/events` (`user.prompt.expansion`) | Record slash-command / MCP-prompt expansion | `UserPromptExpansion` | Optional |
| `/ingest/v1/workflow` | Planning lane snapshot | `SessionStart`, `Setup`, `PreCompact`, `PostCompact`, `PostToolBatch`, `CwdChanged`, `Notification`, `ConfigChange` | Optional |
| `/ingest/v1/events` (`file.changed`) | Record changes to watched files (CLAUDE.md, .env, settings) | `FileChanged` | Optional |
| `/ingest/v1/events` (`worktree.create` / `worktree.remove`) | Record worktree lifecycle | `WorktreeCreate`, `WorktreeRemove` | Optional |
| `/ingest/v1/workflow` | Record loaded instruction files | `InstructionsLoaded` | Optional |
| `/ingest/v1/workflow` | Record structured planning step | MCP/manual only | Optional |
| `/ingest/v1/workflow` | Record agent action before execution | MCP/manual only; `SubagentStart`, `SubagentStop` also route here | Optional |
| `/ingest/v1/workflow` | Record verification step result | MCP/manual only | Optional |
| `/ingest/v1/events` or `/ingest/v1/workflow` | Record rule-related events | `PermissionDenied`, `PermissionRequest` (Claude + Codex) | Optional |
| `/ingest/v1/conversation` | Record question flow | MCP/manual only | Optional |
| `/ingest/v1/workflow` | Record summarized reasoning | MCP/manual only | Optional |

## Tool Usage

Claude's PostToolUse matcher is one-per-official-tool (see
[claude-setup.md § PostToolUse](./claude-setup.md#postooluse--per-tool-subhandlers)):

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/ingest/v1/tool-activity` | Record implementation action | `PostToolUse(Edit)`, `PostToolUse(Write)`, `PostToolUse(NotebookEdit)`, `PostToolUse(Read)`, `PostToolUse(Glob)`, `PostToolUse(Grep)`, `PostToolUse(LSP)`, `PostToolUse(WebFetch)`, `PostToolUse(WebSearch)`, `PostToolUse(AskUserQuestion)`, `PostToolUse(ExitPlanMode)`, `PostToolUse(EnterPlanMode\|EnterWorktree\|ExitWorktree)`, `PostToolUse(BashOutput)`, `PostToolUse(KillShell)`, `PostToolUse(ToolSearch)`, `PostToolUseFailure` | Required |
| `/ingest/v1/tool-activity` | Record file/web exploration | (covered by the per-tool handlers above sharing `_explore.ops.ts`) | Required |
| `/ingest/v1/tool-activity` | Record terminal command execution | `PostToolUse(Bash)`, `PostToolUse(PowerShell)`, Codex `PostToolUse(Bash)` | Use if bash-family tools exist |
| `/ingest/v1/events` (`monitor.observed`) | Record long-running watch (Monitor tool) | `PostToolUse(Monitor)` | Optional |
| `/ingest/v1/tool-activity` | Record Codex `apply_patch` (alias `Edit` / `Write`) | Codex `PostToolUse(apply_patch)` + rollout cross-check | Use for Codex |
| `/ingest/v1/workflow` | Record todo state changes | `PostToolUse(TaskCreate)`, `PostToolUse(TaskUpdate)`, `PostToolUse(TodoWrite)`, `TaskCreated`, `TaskCompleted` | Use if todo tools exist |
| `/ingest/v1/coordination` | Record cron schedule lifecycle | `PostToolUse(CronCreate\|CronDelete\|CronList)` | Optional |

## Agent/Background

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/ingest/v1/coordination` | Record delegation/skill/MCP calls | `PostToolUse(Agent)`, `PostToolUse(Skill)`, `PostToolUse(mcp__*)`; Codex `PostToolUse(mcp__*)` + rollout cross-check | Use if subagent or skill concept exists |
| `/ingest/v1/coordination` | Background task state | `SubagentStart`, `SubagentStop` | Use if background execution exists |
| `/ingest/v1/tasks/link` | Link parent-child tasks | When child runtime session is acquired | Use if background lineage exists |

## Verification Rules

Verification rules are user-defined trigger/expect contracts. Rules are stored
globally or for one task, matched against events while turns are open, and
evaluated definitively when a `(user.message -> assistant.response)` turn
closes.

| API | Role |
|-----|------|
| `GET /api/v1/rules` | List global/task rules; supports `scope`, `taskId`, and `source` query filters |
| `POST /api/v1/rules` | Create a global or task-scoped rule |
| `PATCH /api/v1/rules/:id` | Update a rule |
| `DELETE /api/v1/rules/:id` | Soft-delete a rule |
| `POST /api/v1/rules/:id/promote` | Promote a task-scoped rule to a global rule |
| `POST /api/v1/rules/:id/re-evaluate` | Backfill rule enforcements/verdicts for existing turns |
| `GET /api/v1/tasks/:taskId/rules` | List global + task-scoped rules active for a task |
| `GET /api/v1/tasks/:taskId/verdict-counts` | Count turn verdict statuses for a task |

Rules can match trigger phrases against user/assistant text and expected
tool/command/pattern activity against timeline events. Matches write
`rule_enforcements` rows. The timeline repository then overrides matching
events to the `rule` lane at read time while preserving the original lane in
event metadata.

## Minimum Implementation Order for New Runtime

```text
1. /ingest/v1/sessions/ensure or /ingest/v1/tasks/start
2. /ingest/v1/conversation (user.message)
3. /ingest/v1/tool-activity (tool.used)
4. /ingest/v1/tool-activity (exploration or terminal events)
5. /ingest/v1/conversation (assistant.response)
6. /ingest/v1/sessions/end
```

Then optionally add `/ingest/v1/workflow`, `/ingest/v1/coordination`,
`/ingest/v1/lifecycle`, `/ingest/v1/telemetry`, and `/ingest/v1/tasks/link`
as needed.
