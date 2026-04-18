# Agent Tracer - API Integration Map

This is a reference organizing API endpoint usage per runtime.
The automatic adapter currently implemented in the repository is the Claude Code plugin;
other runtimes can be attached by calling the same API directly.

Implementation basis:
- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude plugin implementation: `packages/runtime-claude/hooks/*.ts`

Related documentation:
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md)
- [Runtime capabilities](./runtime-capabilities.md)

## Session Lifecycle

| API | Role | Claude Code plugin | Manual runtime |
|-----|------|-------------------|-----------------|
| `/api/runtime-session-ensure` | Runtime session upsert | `SessionStart`, `UserPromptSubmit`, `PreToolUse` | Use if stable runtime session ID is available |
| `/api/task-start` | Explicit task/session creation | Rarely used | Use when no session ID-based binding |
| `/api/runtime-session-end` | Runtime session closure | `Stop`, `SessionEnd` | Use to separate turn end from task end |
| `/api/session-end` | Task-level session closure | Not called directly | Use to close resumable sessions only |
| `/api/task-complete` | Full task closure | Not called directly | Use at end of entire work item |
| `/api/assistant-response` | Record assistant turn result | `Stop` | Call if assistant has final text |

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

## Minimum Implementation Order for New Runtime

```text
1. /api/runtime-session-ensure or /api/task-start
2. /api/user-message
3. /api/tool-used
4. /api/explore
5. /api/assistant-response
6. /api/runtime-session-end or /api/session-end
```

Then optionally add `/api/terminal-command`, `/api/todo`, `/api/save-context`,
`/api/agent-activity`, `/api/async-task`, `/api/task-link`, `/api/question`, `/api/thought`
as needed.
