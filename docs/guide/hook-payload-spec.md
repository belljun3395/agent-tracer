# Claude Code Hook Payload Spec

Official documentation: https://code.claude.com/docs/en/hooks

This document organizes stdin payloads focusing on the Claude hook subset currently
used by Agent Tracer.
The `[Observed]` notation indicates parts where official spec and actual behavior differ.

Events currently in official docs but not covered in detail on this page:
`InstructionsLoaded`, `PermissionRequest`, `Notification`, `TaskCreated`,
`TaskCompleted`, `StopFailure`, `ConfigChange`, `CwdChanged`, `FileChanged`,
`WorktreeCreate`, `WorktreeRemove`, `Elicitation`, `ElicitationResult`,
`TeammateIdle`.

---

## Common Fields

Fields included in all hook events per official spec:

| Field | Type | Description |
|-------|------|-------------|
| `session_id` | string | Current Claude Code session ID |
| `transcript_path` | string | Path to conversation transcript JSONL file |
| `cwd` | string | Current working directory |
| `hook_event_name` | string | Event name |
| `permission_mode` | string | `"default"` \| `"plan"` \| `"acceptEdits"` \| `"dontAsk"` \| `"bypassPermissions"` |
| `agent_id` | string? | Included only inside subagent |
| `agent_type` | string? | Included when `--agent` flag or subagent is used |

> **[Observed]** `transcript_path` and `permission_mode` are actually missing in some events.
> Missing events: `SessionStart`, `SessionEnd`, `SubagentStart`, `PreCompact`, `PostCompact`
> Hook code should not depend on these fields.

---

## Per-Event Payloads

### SessionStart

Trigger: After Claude Code startup, resume, `/clear`, `/compact`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SessionStart"` |
| `source` | string | `"startup"` \| `"resume"` \| `"clear"` \| `"compact"` |
| `model` | string | Model ID in use (**[Observed]** undocumented in spec) |

> **[Observed]** No `transcript_path`, `permission_mode`.
> **[Observed]** `model` field actually exists (e.g., `"claude-sonnet-4-6"`).

---

### SessionEnd

Trigger: On session closure

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SessionEnd"` |
| `reason` | string | `"clear"` \| `"resume"` \| `"logout"` \| `"prompt_input_exit"` \| `"bypass_permissions_disabled"` \| `"other"` |

> **[Observed]** No `transcript_path`, `permission_mode`.

---

### UserPromptSubmit

Trigger: When user message is submitted

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"UserPromptSubmit"` |
| `prompt` | string | Full user input text |

---

### PreToolUse

Trigger: Just before tool execution

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PreToolUse"` |
| `tool_name` | string | Tool name (`Bash`, `Edit`, `Write`, `Read`, `Glob`, `Grep`, `Agent`, `Skill`, `mcp__*`, etc.) |
| `tool_input` | object | Per-tool input (see below) |
| `tool_use_id` | string | Unique tool call ID |

> **[Observed]** When tool is called inside subagent, `agent_id` and `agent_type` are additionally included.
> This allows identifying which subagent made the call.

**tool_input structure (per tool):**

```
Bash:        { command, description?, timeout?, run_in_background? }
Edit:        { file_path, old_string, new_string, replace_all? }
Write:       { file_path, content }
Read:        { file_path, offset?, limit? }
Glob:        { pattern, path? }
Grep:        { pattern, path?, glob?, output_mode?, "-i"?, multiline? }
WebSearch:   { query }
WebFetch:    { url, prompt? }
Agent:       { description?, prompt, subagent_type?, model?, run_in_background? }
Skill:       { skill, args? }
mcp__*:      Varies by MCP server/tool
```

> The structure above summarizes fields currently used by Agent Tracer.
> For exhaustive schema, consult the official hooks reference first.

## Agent Tracer Custom Metadata

### Semantic Metadata Contract

Shared semantic metadata consumed by the UI:

```typescript
// Defined in packages/domain/src/interop/event-semantic.ts
interface EventSemanticMetadata {
  readonly subtypeKey: EventSubtypeKey;  // "read_file", "run_test", "mcp_call", ...
  readonly subtypeLabel?: string;        // UI-friendly label
  readonly subtypeGroup: EventSubtypeGroup;  // "files", "execution", "coordination", ...
  readonly toolFamily: EventToolFamily;  // "explore", "file", "terminal", "coordination"
  readonly operation: string;            // "search", "modify", "execute", "delegate"
  readonly entityType?: string;          // "file", "directory", "command", ...
  readonly entityName?: string;          // Specific filename, command name, etc.
  readonly sourceTool?: string;          // Original tool name
  readonly importance?: string;          // "critical", "normal", "minor"
}
```

This contract is derived **server-side** at ingestion in
`@monitor/classification` (see `packages/classification/src/classifier.ts`
and `packages/classification/src/semantic-metadata.ts`). The plugin sends
raw payloads only. The derived fields are used for UI rendering in
`packages/web-app/src/lib/eventSubtype.ts`.

### Per-Tool Additional Metadata

`explore.ts` and `tool_used.ts` inject per-tool additional information into the `metadata` field:

| Tool | Additional Metadata | Description |
|------|--------------------| ------------|
| `WebSearch` | `metadata.webUrls: string[]` | Search query stored up to 300 chars. Displayed in Dashboard Exploration tab Web Lookups section |
| `WebFetch` | `metadata.webUrls: string[]` | Fetched URL stored up to 300 chars |
| All explore tools | `metadata.toolInput` | Original `tool_input` stored as JSON string (for debugging) |
| `mcp__*` | Per-tool custom fields | Unique metadata per MCP tool |

These fields are **Agent Tracer's own extensions** not present in the official Claude Code hook payload spec.

---

### PostToolUse

Trigger: After successful tool execution

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostToolUse"` |
| `tool_name` | string | Tool name |
| `tool_input` | object | Same as PreToolUse |
| `tool_response` | object | Tool execution result (varies per tool, can be large) |
| `tool_use_id` | string | Unique tool call ID |

> **[Observed]** `tool_response` can be very large, including full file contents in Read/Edit, etc.
> Recommended to remove or truncate when logging.

---

### PostToolUseFailure

Trigger: After tool execution failure

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostToolUseFailure"` |
| `tool_name` | string | Tool name |
| `tool_input` | object | Same as PreToolUse |
| `tool_use_id` | string | Unique tool call ID |
| `error` | string | Error message |
| `is_interrupt` | boolean? | Whether interrupted by user |

---

### SubagentStart

Trigger: When subagent starts

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SubagentStart"` |
| `agent_id` | string | Unique subagent ID |
| `agent_type` | string | Subagent type name (e.g., `"general-purpose"`) |

> **[Observed]** No `transcript_path`, `permission_mode`.

---

### SubagentStop

Trigger: When subagent stops
**Fire order: `SubagentStop` → `PostToolUse(Agent)`**

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SubagentStop"` |
| `agent_id` | string | Unique subagent ID |
| `agent_type` | string | Subagent type name |
| `stop_hook_active` | boolean | Whether stop hook is active |
| `agent_transcript_path` | string | Subagent transcript path |
| `last_assistant_message` | string | Full last response from subagent |

> **[Observed]** When `/compact` is performed, a compact-specific subagent runs internally.
> In this case, `agent_type` comes as **empty string `""`** (regular subagents have a type name).
> Current code treats this with `|| "unknown"`, but preserving `""` as-is is needed to identify compact agents.

---

### PreCompact

Trigger: Just before context compression (`/compact` or automatic)

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PreCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `custom_instructions` | string | User compact instructions (empty string `""` if not provided) |

> **[Observed]** No `transcript_path`, `permission_mode`.
> **[Observed]** `custom_instructions` is empty string `""` if not provided, not `null`.

---

### PostCompact

Trigger: After context compression completes

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `compact_summary` | string | Full compression summary (`<analysis>...</analysis><summary>...</summary>` format, can be very long) |

> **[Observed]** No `transcript_path`, `permission_mode`.
> **[Observed]** `compact_summary` is XML-formatted analysis + summary text, several KB in size.

---

## Event Fire Order

```
Session start
  └─ SessionStart

User input
  └─ UserPromptSubmit

Tool execution
  ├─ PreToolUse
  ├─ (tool execution)
  └─ PostToolUse | PostToolUseFailure

Agent tool execution
  ├─ PreToolUse (tool_name: "Agent")
  ├─ SubagentStart
  ├─ (tools inside subagent: PreToolUse / PostToolUse repeating)
  ├─ SubagentStop
  └─ PostToolUse (tool_name: "Agent")   ← after SubagentStop

/compact execution
  ├─ PreCompact
  ├─ SubagentStart (agent_type: "")     ← compact-specific internal agent
  ├─ SubagentStop  (agent_type: "")
  └─ PostCompact

Session end
  └─ SessionEnd
```

---

## Subagent Event Routing

### The session_id problem

**All hooks — including those that fire inside a subagent — receive the parent session's `session_id`.**
The `session_id` field does not change when Claude Code dispatches a subagent. This means a naive
`resolveSessionIds(session_id)` call always returns the parent task's IDs, causing subagent tool
events to be recorded under the parent instead of a separate child task.

`agent_id` is the **only** field that distinguishes subagent context from parent context.

### Virtual session ID pattern (Agent Tracer solution)

Agent Tracer resolves this by mapping every `agent_id` to a **virtual session ID**:

```
virtualId = `sub--${agentId}`
```

`resolveEventSessionIds(sessionId, agentId?, agentType?)` is the canonical dispatcher:

- `agentId` absent → falls through to `resolveSessionIds(sessionId)` (parent task, unchanged)
- `agentId` present → calls `resolveSubagentSessionIds(sessionId, agentId, agentType)`:
  1. Resolve parent session to obtain `parentTaskId`
  2. Call `ensureRuntimeSession(virtualId, title, { parentTaskId })` → server creates (or reuses) the background child task
  3. Return the child `(taskId, sessionId)` for this hook invocation

This relies entirely on the server's idempotent `ensureRuntimeSession`
endpoint (`EnsureRuntimeSessionUseCase`). Since v0.2.0 the plugin no
longer persists a session cache to disk — every hook subprocess calls
the endpoint directly; repeated calls with the same `runtimeSessionId`
return the same `(taskId, sessionId)` without creating duplicates.

### Lifecycle

| Event | Behaviour |
|-------|-----------|
| `SubagentStart` | Eagerly calls `resolveSubagentSessionIds` → child background task created immediately via idempotent `ensureRuntimeSession(virtualId, …, { parentTaskId })` |
| `PreToolUse` (inside subagent) | Calls `resolveEventSessionIds(sessionId, agentId)` → ensures session exists before first tool fires |
| `PostToolUse/*` (inside subagent) | All tool events routed to child task timeline via `resolveEventSessionIds` |
| `Stop` (inside subagent) | `assistant.response` recorded on child task; session-end skipped (SubagentStop handles it) |
| `SubagentStop` | Calls `POST /api/runtime-session-end` for the virtual session to trigger auto-completion; cursor for `sub--{agentId}` is deleted |

---

## Code Implementation Notes

| Situation | Current | Recommended |
|-----------|---------|------------|
| `transcript_path` usage | - | Do not use, may be missing |
| `agent_type` default | `\|\| "unknown"` | Preserve as `\|\| ""` to distinguish compact agents |
| `custom_instructions` empty | `\|\| ""` (already handled) | Keep current code |
| `compact_summary` logging | - | Length limit required (several KB) |
| `tool_response` logging | Being removed in hookLogPayload | Preserve |
| `session_id` in subagent hooks | Parent's session_id is always sent | Use `agent_id` + `resolveEventSessionIds` to route to child task |
