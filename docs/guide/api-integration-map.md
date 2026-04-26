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
| `/ingest/v1/workflow` | Planning lane snapshot | `SessionStart`, `PreCompact`, `PostCompact`, `PostToolBatch`, `CwdChanged`, `Notification`, `ConfigChange` | Optional |
| `/ingest/v1/workflow` | Record loaded instruction files | `InstructionsLoaded` | Optional |
| `/ingest/v1/workflow` | Record structured planning step | MCP/manual only | Optional |
| `/ingest/v1/workflow` | Record agent action before execution | MCP/manual only; `SubagentStart`, `SubagentStop` also route here | Optional |
| `/ingest/v1/workflow` | Record verification step result | MCP/manual only | Optional |
| `/ingest/v1/workflow` | Record rule-related events | `PermissionDenied`, Codex `PermissionRequest` | Optional |
| `/ingest/v1/conversation` | Record question flow | MCP/manual only | Optional |
| `/ingest/v1/workflow` | Record summarized reasoning | MCP/manual only | Optional |

## Tool Usage

Claude's PostToolUse matcher is one-per-official-tool (see
[claude-setup.md § PostToolUse](./claude-setup.md#postooluse--per-tool-subhandlers)):

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/ingest/v1/tool-activity` | Record implementation action | `PostToolUse(Edit)`, `PostToolUse(Write)`, `PostToolUse(Read)`, `PostToolUse(Glob)`, `PostToolUse(Grep)`, `PostToolUse(WebFetch)`, `PostToolUse(WebSearch)`, `PostToolUse(AskUserQuestion)`, `PostToolUse(ExitPlanMode)`, `PostToolUseFailure` | Required |
| `/ingest/v1/tool-activity` | Record file/web exploration | (covered by the per-tool handlers above sharing `_explore.ops.ts`) | Required |
| `/ingest/v1/tool-activity` | Record terminal command execution | `PostToolUse(Bash)`, Codex `PostToolUse(Bash)` | Use if bash-family tools exist |
| `/ingest/v1/workflow` | Record todo state changes | `PostToolUse(TaskCreate)`, `PostToolUse(TaskUpdate)`, `PostToolUse(TodoWrite)`, `TaskCreated`, `TaskCompleted` | Use if todo tools exist |

## Agent/Background

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/ingest/v1/coordination` | Record delegation/skill/MCP calls | `PostToolUse(Agent)`, `PostToolUse(Skill)`, `PostToolUse(mcp__*)` | Use if subagent or skill concept exists |
| `/ingest/v1/coordination` | Background task state | `SubagentStart`, `SubagentStop` | Use if background execution exists |
| `/ingest/v1/tasks/link` | Link parent-child tasks | When child runtime session is acquired | Use if background lineage exists |

## Rule Commands

Rule commands are user-defined patterns that cause matching `terminal.command` events to be
re-classified into the `rule` lane at ingest time. Patterns are stored in SQLite and applied
per-task or globally.

| API | Role |
|-----|------|
| `POST /api/v1/rule-commands` | Register a global rule pattern |
| `DELETE /api/v1/rule-commands/:id` | Delete a global rule pattern |
| `GET /api/v1/rule-commands` | List all global rule patterns |
| `POST /api/v1/tasks/:taskId/rule-commands` | Register a task-scoped rule pattern |
| `DELETE /api/v1/tasks/:taskId/rule-commands/:id` | Delete a task-scoped rule pattern |
| `GET /api/v1/tasks/:taskId/rule-commands` | List task-scoped rule patterns |

Pattern matching is **substring / includes** (case-insensitive). A pattern like `"npm run lint"`
matches any command string that contains that substring (e.g. `npm run lint --fix`).

At ingest (`/ingest/v1/tool-activity`), global patterns and the event's task-specific patterns
are merged and tested against each `terminal.command` event. Matching events have their `lane`
field replaced with `"rule"` before the events are persisted.

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
