# MCP Tool Reference

Currently, the MCP surface provides 24 tools. Instead of just listing names,
this document explains what problem each tool solves, organized by category.

## 1. Task Lifecycle

- `monitor_task_start`
- `monitor_task_complete`
- `monitor_task_error`
- `monitor_task_link`
- `monitor_runtime_session_ensure`
- `monitor_runtime_session_end`
- `monitor_session_end`

This group handles task/session creation/termination and background lineage connections.
It's characterized by having both runtime-scoped and explicit session-end paths.

## 2. Event Logging

- `monitor_tool_used`
- `monitor_terminal_command`
- `monitor_save_context`
- `monitor_plan`
- `monitor_action`
- `monitor_verify`
- `monitor_rule`
- `monitor_explore`
- `monitor_user_message`
- `monitor_assistant_response`

Most of the timeline is generated from this group.
In particular, `monitor_user_message` and `monitor_assistant_response` are canonical paths for conversation boundaries.

## 3. Semantic Flow / Coordination

- `monitor_async_task`
- `monitor_agent_activity`
- `monitor_question`
- `monitor_todo`
- `monitor_thought`

This group records more structured semantics than simple logs.
It preserves information like background tasks, delegation, question flow, todo state, and summarized thoughts.

## 4. Workflow Library

- `monitor_evaluate_task`
- `monitor_find_similar_workflows`

It's a feature to save good examples after work is done and find similar workflows in the next task.

## Common Combinations in Practice

### Manual Runtime Path

- `monitor_runtime_session_ensure`
- `monitor_user_message`
- `monitor_explore` / `monitor_terminal_command` / `monitor_plan`
- `monitor_assistant_response`
- `monitor_runtime_session_end`

### Claude Plugin Supplementary Path

- Manual augmentation tools like `monitor_rule`, `monitor_verify`, `monitor_async_task` when auto hooks miss something

### Task Evaluation Path

- Confirm user's intention to evaluate with `monitor_question`
- Save with `monitor_evaluate_task`
- Search with `monitor_find_similar_workflows` on next task start

## Internal Transmission Method

All tools except the 7 lifecycle tools are sent to the `POST /ingest/v1/events`
batch endpoint. Each tool wraps a single event in the form `events: [{ kind: "...", ...input }]`.

| Tool | kind |
|------|------|
| `monitor_tool_used` | `tool.used` |
| `monitor_terminal_command` | `terminal.command` |
| `monitor_save_context` | `context.saved` |
| `monitor_plan` | `plan.logged` |
| `monitor_action` | `action.logged` |
| `monitor_verify` | `verification.logged` |
| `monitor_rule` | `rule.logged` |
| `monitor_explore` | `tool.used` + `lane: "exploration"` |
| `monitor_async_task` | `action.logged` + `asyncTaskId` |
| `monitor_agent_activity` | `agent.activity.logged` |
| `monitor_user_message` | `user.message` |
| `monitor_assistant_response` | `assistant.response` |
| `monitor_question` | `question.logged` |
| `monitor_todo` | `todo.logged` |
| `monitor_thought` | `thought.logged` |

`monitor_session_end` uses the lifecycle path (`/api/session-end`) directly.

## Maintenance Notes

- When adding a new tool, check the kind list in `schemas.ingest.ts`, dispatch in `event-ingestion-service.ts`, and guide documentation together.
- Keep tool names in snake_case format, and use clear verbs for user-facing descriptions.
- Since it's manual registration without a declarative manifest, lists and implementations can easily diverge.

## Related Documentation

- [MCP Server](./mcp-server.md)
- [HTTP API Reference](./http-api-reference.md)
- [Workflow Library & Evaluation](./workflow-library-and-evaluation.md)
