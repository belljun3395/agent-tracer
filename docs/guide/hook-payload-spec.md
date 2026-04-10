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

Explicit metadata added by the hook layer to all exploration/file/execution tools:

```typescript
// Defined in packages/core/src/event-semantic.ts
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

This contract is implemented per-tool in `.claude/plugin/hooks/classification/` and
used for UI rendering in `packages/web/src/lib/eventSubtype.ts`.

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

## Code Implementation Notes

| Situation | Current | Recommended |
|-----------|---------|------------|
| `transcript_path` usage | - | Do not use, may be missing |
| `agent_type` default | `\|\| "unknown"` | Preserve as `\|\| ""` to distinguish compact agents |
| `custom_instructions` empty | `\|\| ""` (already handled) | Keep current code |
| `compact_summary` logging | - | Length limit required (several KB) |
| `tool_response` logging | Being removed in hookLogPayload | Preserve |
