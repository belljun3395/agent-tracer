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
| `/api/runtime-session-ensure` | Runtime session upsert | `SessionStart`, `UserPromptSubmit`, `PreToolUse` | Use if stable runtime session ID is available |
| `/api/task-start` | Explicit task/session creation | Rarely used | Use when no session ID-based binding |
| `/api/runtime-session-end` | Runtime session closure | `Stop`, Claude `SessionEnd` | Use to separate turn end from task end; pass `completeTask: true` only for a completed work item |
| `/api/task-complete` | Full task closure | Not called directly | Use at end of entire work item |
| `/ingest/v1/conversation` (`assistant.response`) | Record assistant turn result | `Stop` | Send an `assistant.response` event if assistant has final text |

## Messages/Context

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/api/user-message` | Record user input | `UserPromptSubmit` | Required |
| `/api/save-context` | Planning lane snapshot | `SessionStart`, `PreCompact`, `PostCompact` | Optional |
| `/api/plan` | Record structured planning step | MCP/manual only | Optional |
| `/api/action` | Record agent action before execution | MCP/manual only | Optional |
| `/api/verify` | Record verification step result | MCP/manual only | Optional |
| `/api/rule` | Record rule-related events | MCP/manual only | Optional |
| `/api/question` | Record question flow | MCP/manual only | Optional |
| `/api/thought` | Record summarized reasoning | MCP/manual only | Optional |

## Tool Usage

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/api/tool-used` | Record implementation action | `PostToolUse(Edit|Write|mcp__*)`, `PostToolUseFailure` | Required |
| `/api/explore` | Record file/web exploration | `PostToolUse(Read|Glob|Grep|WebSearch|WebFetch)` | Required |
| `/api/terminal-command` | Record terminal command execution | `PostToolUse(Bash)` | Use if bash-family tools exist |
| `/api/todo` | Record todo state changes | `PostToolUse(TodoWrite|TaskCreate|TaskUpdate)` | Use if todo tools exist |

## Agent/Background

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/api/agent-activity` | Record delegation/skill/MCP calls | `PostToolUse(Agent|Skill|mcp__*)` | Use if subagent or skill concept exists |
| `/api/async-task` | Background task state | `SubagentStart`, `SubagentStop` | Use if background execution exists |
| `/api/task-link` | Link parent-child tasks | When child runtime session is acquired | Use if background lineage exists |

## Rule Commands

Rule commands are user-defined patterns that cause matching `terminal.command` events to be
re-classified into the `rule` lane at ingest time. Patterns are stored in SQLite and applied
per-task or globally.

| API | Role |
|-----|------|
| `POST /api/rule-commands` | Register a global rule pattern |
| `DELETE /api/rule-commands/:id` | Delete a global rule pattern |
| `GET /api/rule-commands` | List all global rule patterns |
| `POST /api/tasks/:taskId/rule-commands` | Register a task-scoped rule pattern |
| `DELETE /api/tasks/:taskId/rule-commands/:id` | Delete a task-scoped rule pattern |
| `GET /api/tasks/:taskId/rule-commands` | List task-scoped rule patterns |

Pattern matching is **substring / includes** (case-insensitive). A pattern like `"npm run lint"`
matches any command string that contains that substring (e.g. `npm run lint --fix`).

At ingest (`/ingest/v1/tool-activity`), global patterns and the event's task-specific patterns
are merged and tested against each `terminal.command` event. Matching events have their `lane`
field replaced with `"rule"` before the events are persisted.

## Minimum Implementation Order for New Runtime

```text
1. /api/runtime-session-ensure or /api/task-start
2. /api/user-message
3. /api/tool-used
4. /api/explore
5. /ingest/v1/conversation (assistant.response)
6. /api/runtime-session-end
```

Then optionally add `/api/terminal-command`, `/api/todo`, `/api/save-context`,
`/api/agent-activity`, `/api/async-task`, `/api/task-link`, `/api/question`, `/api/thought`
as needed.
