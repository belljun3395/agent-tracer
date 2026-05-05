# Claude Code Hook Payload Spec

Official documentation: https://code.claude.com/docs/en/hooks

This document organizes stdin payloads focusing on the Claude hook subset currently
used by Agent Tracer.
The `[Observed]` notation indicates parts where official spec and actual behavior differ.

Agent Tracer's Claude plugin currently handles **27 of the 28 official hook
events**. Payload readers for every handled event live at
`packages/runtime/src/shared/hooks/claude/payloads.ts` and are invoked by
each hook via the shared `runHook()` wrapper at
`packages/runtime/src/shared/hook-runtime/`.

Events currently in official docs but not yet handled by the plugin:
`TeammateIdle` (experimental agent teams), `Elicitation`, `ElicitationResult`
(MCP form input).

## Privacy contract

The plugin captures **action-side data only** — what the agent invoked, with
which arguments — and never the **result body**. Specifically, every
`PostToolUse` handler ignores `tool_response` entirely. No stdout, stderr,
file content, web response body, MCP tool result, search result list, or
grep snippet ever leaves the host. Tool inputs (commands, queries, prompts,
file paths, offsets, glob filters, domain allowlists, etc.) are captured
because they describe the agent's action.

The same contract applies to the Codex adapter — see
`packages/runtime/CODEX_DATA_FLOW.md`.

## Async hooks

Stateless event-emitting hooks (PostToolUse and its variants, PostToolBatch,
PostToolUseFailure, Stop / StopFailure / SessionEnd, Notification,
SubagentStop, TaskCreated / TaskCompleted, ConfigChange / CwdChanged /
FileChanged, PreCompact / PostCompact, PermissionDenied, WorktreeRemove,
UserPromptExpansion, InstructionsLoaded) are registered with `"async": true`
in `hooks.json` so they fire-and-forget without blocking Claude Code's main
loop.

The remaining hooks stay synchronous because their effect must be observed
before the next step proceeds: `PreToolUse`, `SessionStart`, `Setup`,
`UserPromptSubmit`, `SubagentStart`, `PermissionRequest`, `WorktreeCreate`.

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

Per-event payload readers surface `session_id`, `cwd`, `transcript_path`,
`permission_mode`, `agent_id`, and `agent_type` on a common
`ClaudeSessionContextBase` interface. Each event extends it with its
event-specific fields.

---

## Per-Event Payloads

### SessionStart

Trigger: After Claude Code startup, resume, `/clear`, `/compact`
Reader: `readSessionStart()`
Matchers: `startup|resume|clear|compact`

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
Reader: `readSessionEnd()`
Matchers: `clear|resume|logout|prompt_input_exit|bypass_permissions_disabled|other`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SessionEnd"` |
| `reason` | string | `"clear"` \| `"resume"` \| `"logout"` \| `"prompt_input_exit"` \| `"bypass_permissions_disabled"` \| `"other"` |

> **[Observed]** No `transcript_path`, `permission_mode`.

---

### UserPromptSubmit

Trigger: When user message is submitted
Reader: `readUserPromptSubmit()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"UserPromptSubmit"` |
| `prompt` | string | Full user input text |

---

### InstructionsLoaded

Trigger: When a CLAUDE.md / `.claude/rules/*.md` file is loaded into context
Reader: `readInstructionsLoaded()`
Matchers: `session_start|nested_traversal|path_glob_match|include|compact`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"InstructionsLoaded"` |
| `file_path` | string | Absolute path of the loaded instruction file |
| `memory_type` | string | `"User"` \| `"Project"` \| `"Local"` \| `"Managed"` |
| `load_reason` | string | `session_start|nested_traversal|path_glob_match|include|compact` |
| `globs` | string[]? | Glob patterns that triggered the load |
| `trigger_file_path` | string? | File that triggered a lazy include |
| `parent_file_path` | string? | File that included this one |

---

### PreToolUse

Trigger: Just before tool execution
Reader: `readPreToolUse()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PreToolUse"` |
| `tool_name` | string | See "Supported tools" below |
| `tool_input` | object | Per-tool input (see below) |
| `tool_use_id` | string | Unique tool call ID |

> **[Observed]** When tool is called inside subagent, `agent_id` and `agent_type` are additionally included.
> This allows identifying which subagent made the call.

**Supported tools** (each has a registered PostToolUse matcher):
`Bash`, `PowerShell`, `BashOutput`, `KillShell`, `Monitor`, `Edit`, `Write`,
`NotebookEdit`, `Read`, `Glob`, `Grep`, `LSP`, `WebFetch`, `WebSearch`,
`Agent`, `Skill`, `TaskCreate`, `TaskUpdate`, `TodoWrite`, `AskUserQuestion`,
`ExitPlanMode`, `EnterPlanMode`, `EnterWorktree`, `ExitWorktree`,
`CronCreate`, `CronDelete`, `CronList`, `ToolSearch`, `mcp__*`.

**tool_input structure (per tool):**

```
Bash:            { command, description?, timeout?, run_in_background? }
PowerShell:      { command, description?, run_in_background? }       # same shape as Bash
BashOutput:      { bash_id, filter? }
KillShell:       { bash_id }
Monitor:         { command, description?, filter? }
Edit:            { file_path, old_string, new_string, replace_all? }
Write:           { file_path, content }
NotebookEdit:    { notebook_path, cell_id?, new_source, edit_mode? }
Read:            { file_path, offset?, limit? }
Glob:            { pattern, path? }
Grep:            { pattern, path?, glob?, output_mode?, "-i"?, multiline? }
LSP:             { operation, file_path?, line?, column?, symbol? }
WebSearch:       { query, allowed_domains?, blocked_domains? }
WebFetch:        { url, prompt }
Agent:           { description?, prompt, subagent_type?, model?, run_in_background? }
Skill:           { skill, args? }
TaskCreate:      { task_subject, task_description? }
TaskUpdate:      { task_id, status }
TodoWrite:       { todos: [{ content, status, priority }] }
AskUserQuestion: { question, options? }
ExitPlanMode:    { plan }
EnterPlanMode:   {}
EnterWorktree:   { path? }
ExitWorktree:    {}
CronCreate:      { schedule, prompt }
CronDelete:      { id }
CronList:        {}
ToolSearch:      { query }
mcp__*:          Varies by MCP server/tool
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

This contract is derived **server-side** at ingestion inside
`@monitor/server` (see the classification paths under
`packages/server/src/application/events/`). The plugin sends raw payloads
only. The derived fields are consumed by the web dashboard through
`packages/web/src/app/lib/timeline.ts`.

### Per-Tool Additional Metadata

The PostToolUse per-tool handlers share ops modules:
`PostToolUse/{Read,Glob,Grep,WebFetch,WebSearch,AskUserQuestion,ExitPlanMode}.ts` → `_explore.ops.ts`;
`PostToolUse/{Edit,Write,NotebookEdit}.ts` → `_file.ops.ts`;
`PostToolUse/Agent.ts` → `_agent.ops.ts`;
`PostToolUse/Skill.ts` → `_skill.ops.ts`;
`PostToolUse/{TaskCreate,TaskUpdate,TodoWrite}.ts` → `_todo.ops.ts`.
Each ops module injects per-tool additional information into the `metadata` field:

| Tool | Additional Metadata | Description |
|------|--------------------| ------------|
| `Bash` / `PowerShell` | `commandAnalysis`, `timeoutMs`, `runInBackground`, `filePaths` | Parsed shell structure (`steps`, `targets`, `effect`); file/path targets surfaced from analysis are promoted to event-level `filePaths` (so `cat foo.ts` appears alongside Read events) |
| `BashOutput` / `KillShell` | `entityName: bash_id` | Background shell lifecycle |
| `Monitor` | `monitorScript`, `monitorDescription` | Long-running watch — emits dedicated `monitor.observed` KIND |
| `Read` | `readOffset`, `readLimit` | Captures requested line range |
| `Grep` | `searchPattern`, `searchPath`, `searchGlob`, `grepOutputMode`, `grepCaseInsensitive`, `grepMultiline` | Full invocation parameters; `grepOutputMode` is the strongest signal of how thoroughly the agent investigated |
| `Glob` | `searchPattern`, `searchPath` | |
| `WebSearch` | `webQuery`, `webAllowedDomains`, `webBlockedDomains`, `webUrls` | Domain filters reveal the agent's intent boundaries |
| `WebFetch` | `webQuery` (URL), `webPrompt`, `webUrls` | `webPrompt` records what the agent was looking for in the page |
| `Edit` | `editReplaceAll` | Bulk-replace flag |
| `Agent` | `agentName`, `agentModel`, `agentRunInBackground` | |
| `LSP` | `subtypeKey: "grep_code"`, `operation: "lsp_<op>"` | Code-intelligence calls |
| `Cron*` | `entityName: schedule\|id` | Scheduled prompt lifecycle |
| `ToolSearch` | `entityName: query` | Deferred MCP tool discovery |
| All explore tools | `toolInput` | Sanitised `tool_input` clone (for debugging) |
| `mcp__*` | Per-tool custom fields | Unique metadata per MCP tool |
| Codex `apply_patch` / `mcp__*` | `crossCheck: { source, dedupeKey }` | Marker for hook ↔ rollout cross-check; server merges duplicate emissions |

These fields are **Agent Tracer's own extensions** not present in the official Claude Code hook payload spec.

---

### PostToolUse

Trigger: After successful tool execution
Reader: `readPostToolUse()`
Matchers: split per official tool — see [claude-setup.md](./claude-setup.md#postooluse--per-tool-subhandlers)

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostToolUse"` |
| `tool_name` | string | Tool name |
| `tool_input` | object | Same as PreToolUse |
| `tool_response` | object | Tool execution result (varies per tool, can be large) |
| `tool_use_id` | string | Unique tool call ID |

> **Privacy contract:** Agent Tracer's PostToolUse handlers **never read
> `tool_response`**. Result bodies (stdout, stderr, file content, web
> response, MCP result, search result list, grep snippets) are not
> captured; only the agent's action (`tool_input`) and quantitative
> wrappers (`commandAnalysis`, evidence reason) are stored.

---

### PostToolUseFailure

Trigger: After tool execution failure
Reader: `readPostToolUseFailure()`
Matchers: `Bash|Edit|Write|Read|Glob|Grep|WebFetch|WebSearch|Agent|Skill|TaskCreate|TaskUpdate|TodoWrite|AskUserQuestion|ExitPlanMode|mcp__.*`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostToolUseFailure"` |
| `tool_name` | string | Tool name |
| `tool_input` | object | Same as PreToolUse |
| `tool_use_id` | string | Unique tool call ID |
| `error` | string | Error message |
| `is_interrupt` | boolean? | Whether interrupted by user |

---

### PostToolBatch

Trigger: After all parallel tool calls in a batch resolve, before the next model call
Reader: `readPostToolBatch()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostToolBatch"` |
| `tool_use_ids` | string[] | IDs of tool calls in the resolved batch |
| `tool_calls` | object[] | `[{ tool_name, tool_input }]` for each call |

Posts a `context.saved` event with `trigger: "tool_batch_completed"` and
`itemCount: batchSize` so the timeline can draw a boundary between parallel
tool fan-outs.

---

### PermissionDenied

Trigger: When a tool call is denied by the auto-mode classifier
Reader: `readPermissionDenied()`
Matchers: same tool-name regex as `PostToolUseFailure`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PermissionDenied"` |
| `tool_name` | string | Tool that was denied |
| `tool_input` | object | Input that would have been used |

Posts a `rule.logged` event with `ruleOutcome: "auto_deny"` and
`rulePolicy: "auto_mode_classifier"`.

---

### SubagentStart

Trigger: When subagent starts
Reader: `readSubagentStart()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SubagentStart"` |
| `agent_id` | string | Unique subagent ID |
| `agent_type` | string | Subagent type name (alias: `subagent_type`, e.g., `"general-purpose"`) |

> **[Observed]** No `transcript_path`, `permission_mode`.
> **[Observed]** Reader accepts either `subagent_type` or `agent_type`.

---

### SubagentStop

Trigger: When subagent stops
Reader: `readSubagentStop()`
**Fire order: `SubagentStop` → `PostToolUse(Agent)`**

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"SubagentStop"` |
| `agent_id` | string | Unique subagent ID |
| `agent_type` | string | Subagent type name |
| `stop_hook_active` | boolean | Whether stop hook is active |
| `agent_transcript_path` | string | Subagent transcript path |
| `last_assistant_message` | string | Full last response from subagent |
| `stop_reason` | string? | Subagent termination reason |

> **[Observed]** When `/compact` is performed, a compact-specific subagent runs internally.
> In this case, `agent_type` comes as **empty string `""`** (regular subagents have a type name).

---

### TaskCreated

Trigger: When a task is created via the `TaskCreate` tool
Reader: `readTaskCreated()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"TaskCreated"` |
| `task_name` | string | Task title |
| `task_description` | string? | Full description |

Posts a `todo.logged` event with `todoState: "added"` and a stable `todoId`
derived from the task name. Complements the `PostToolUse/TaskCreate.ts`
handler which uses the same mapping.

---

### TaskCompleted

Trigger: When a task is marked completed
Reader: `readTaskCompleted()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"TaskCompleted"` |
| `task_name` | string | Task title that completed |

Posts a `todo.logged` event with `todoState: "completed"`.

---

### Stop

Trigger: When Claude finishes responding (end of a turn)
Reader: `readStop()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"Stop"` |
| `stop_reason` | string? | `end_turn|max_tokens|tool_use|…` |
| `last_assistant_message` | string | Final assistant message text |

---

### StopFailure

Trigger: When a turn ends due to an API error
Reader: `readStopFailure()`
Matchers: `rate_limit|authentication_failed|billing_error|invalid_request|server_error|max_output_tokens|unknown`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"StopFailure"` |
| `error_type` | string | One of the matcher values |
| `error_message` | string? | Optional human-readable error text |

Posts an `assistant.response` event with `stopReason: "error:<error_type>"`.

---

### PreCompact

Trigger: Just before context compression (`/compact` or automatic)
Reader: `readPreCompact()`
Matchers: `manual|auto`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PreCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `custom_instructions` | string | User compact instructions (empty string `""` if not provided) |

> **[Observed]** `custom_instructions` is an implementation extension, not in the official schema.
> It is empty string `""` if not provided, not `null`.

---

### PostCompact

Trigger: After context compression completes
Reader: `readPostCompact()`
Matchers: `manual|auto`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PostCompact"` |
| `trigger` | string | `"manual"` \| `"auto"` |
| `compact_summary` | string | Full compression summary (`<analysis>...</analysis><summary>...</summary>` format, can be very long) |

> **[Observed]** `compact_summary` is an implementation extension, XML-formatted, several KB in size.

---

### CwdChanged

Trigger: When the working directory changes (e.g. `cd` command in a Bash tool)
Reader: `readCwdChanged()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"CwdChanged"` |
| `old_cwd` | string? | Previous working directory |
| `new_cwd` | string? | New working directory |

Posts a `context.saved` event with `trigger: "cwd_changed"`.

---

### FileChanged

Trigger: When a watched file changes on disk
Reader: `readFileChanged()`
Matcher: literal pipe-separated filenames (NOT regex), defaults to
`CLAUDE.md|.env|.envrc|.claude/settings.json|.claude/settings.local.json`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"FileChanged"` |
| `file_path` | string | Absolute path of the changed file |

Posts a `file.changed` event in the `background` lane. Metadata: `filePath`, `relPath`.

---

### WorktreeCreate

Trigger: When a worktree is being created via `--worktree` or
`isolation: "worktree"`
Reader: `readWorktree()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"WorktreeCreate"` |
| `worktree_path` | string | Target worktree directory |

Posts a `worktree.create` event in the `background` lane. Stays synchronous
because the official handler may rely on stdout for path resolution; this
plugin never writes stdout, so the default behaviour wins.

---

### WorktreeRemove

Trigger: When a worktree is being removed (session exit / subagent finish)
Reader: `readWorktree()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"WorktreeRemove"` |
| `worktree_path` | string | Removed worktree directory |

Posts a `worktree.remove` event in the `background` lane.

---

### PermissionRequest

Trigger: When a permission dialog is about to show to the user
Reader: `readPermissionRequest()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"PermissionRequest"` |
| `tool_name` | string | Tool that triggered the dialog |
| `tool_input` | object | Pending tool arguments |
| `tool_use_id` | string? | Tool-call id |
| `permission_suggestions` | array | Auto-suggested rules to add |

Posts a `permission.request` event in the `coordination` lane. Metadata:
`toolName`, `toolUseId`, `toolInputSummary` (capped string), `suggestionCount`.
Always returns exit 0 — the plugin never overrides the user's choice.

---

### Setup

Trigger: When Claude Code is invoked with `--init-only`, `--init -p`, or
`--maintenance -p`
Reader: `readSetup()`
Matchers: `init|maintenance`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"Setup"` |
| `trigger` | string | `"init"` \| `"maintenance"` |

Posts a `setup.triggered` event in the `planning` lane.

---

### UserPromptExpansion

Trigger: When a user-typed slash command (or MCP prompt) expands into a
full prompt before Claude processes it
Reader: `readUserPromptExpansion()`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"UserPromptExpansion"` |
| `expansion_type` | string | `"slash_command"` \| `"mcp_prompt"` |
| `command_name` | string | Slash command or MCP prompt name |
| `command_args` | string? | Command arguments |
| `command_source` | string? | Origin of the command |
| `prompt` | string | Full expanded prompt text |

Posts a `user.prompt.expansion` event in the `user` lane. Metadata:
`expansionType`, `commandName`, `commandArgs`, `commandSource`,
`expandedPromptSnippet` (first 2 KB of expanded prompt with `…` if
truncated), `expandedPromptBytes` (utf-8 byte length of full prompt).

> **Why this matters:** without this hook the tracer only sees `/foo` and
> not what `/foo` actually told Claude to do — high-value verification
> signal.

---

### Notification

Trigger: When Claude Code emits a notification to the user
Reader: `readNotification()`
Matchers: `permission_prompt|idle_prompt|auth_success|elicitation_dialog`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"Notification"` |
| `notification_type` | string? | One of the matcher values |
| `notification_message` | string? | Message shown to the user |

Posts a `context.saved` event with `trigger: "notification:<type>"`.

---

### ConfigChange

Trigger: When a settings source changes during a session
Reader: `readConfigChange()`
Matchers: `user_settings|project_settings|local_settings|policy_settings|skills`

| Field | Type | Value |
|-------|------|-------|
| `hook_event_name` | string | `"ConfigChange"` |
| `config_source` | string? | One of the matcher values |

Posts a `context.saved` event with `trigger: "config_change:<source>"`.

> The hook event docs note that `ConfigChange` can block (except for
> `policy_settings`). Agent Tracer never blocks — it only observes.

---

### StatusLine

Trigger: After every API request and on session start. Unlike the other hook
events, `statusLine` is declared as a top-level key (not nested under `hooks`)
in the plugin's `hooks.json`, so the plugin itself owns registration via
`${CLAUDE_PLUGIN_ROOT}` — no project `.claude/settings.json` entry is needed
(see [claude-setup.md](./claude-setup.md#statusline-setup)).

Ref: https://code.claude.com/docs/en/statusline

| Field | Type | Value |
|-------|------|-------|
| `session_id` | string | Current Claude Code session ID |
| `version` | string | Claude Code client version |
| `model.id` | string | Model ID (e.g., `"claude-sonnet-4-6"`) |
| `model.display_name` | string | Human-readable model name |
| `context_window.used_percentage` | number \| null | Context usage as % of the active model's window |
| `context_window.remaining_percentage` | number \| null | Remaining % of the active model's window |
| `context_window.total_input_tokens` | number | Accumulated input tokens |
| `context_window.total_output_tokens` | number | Accumulated output tokens |
| `context_window.context_window_size` | number | Active model's total window size (varies by model) |
| `context_window.current_usage` | object \| null | Latest API call breakdown (input / output / cache-creation / cache-read) |
| `cost.total_cost_usd` | number | Cumulative session cost in USD |
| `rate_limits.five_hour.used_percentage` | number | 5-hour rate-limit usage (Pro/Max only) |
| `rate_limits.five_hour.resets_at` | number | Unix seconds; reset timestamp for 5-hour window |
| `rate_limits.seven_day.used_percentage` | number | 7-day rate-limit usage (Pro/Max only) |
| `rate_limits.seven_day.resets_at` | number | Unix seconds; reset timestamp for 7-day window |

> **[Observed]** `rate_limits` is only present for Pro/Max plans.
> **[Observed]** `used_percentage` is already normalized against the active
> model's window size.

`StatusLine` is not an official hook event — it's a separate
status-line feature. Its handler (`StatusLine.ts`) keeps its own specialized
validation since the payload differs significantly from hook payloads; it does
**not** go through the shared `runHook()` wrapper.

**Agent Tracer behavior:**
- Posts a `context.snapshot` event (lane `telemetry`) on every status refresh.
- Writes `[monitor] ctx N% · 5h N% · $X.XXX` to stdout for Claude Code's status bar.

---

## Codex Hook Payloads

Official documentation: https://developers.openai.com/codex/hooks

Codex exposes 6 hook events: `SessionStart`, `PreToolUse`, `PermissionRequest`,
`PostToolUse`, `UserPromptSubmit`, `Stop`. Agent Tracer has readers and
handlers for all six, all registered in `packages/runtime/src/codex/hooks/hooks.json`.

Readers live at `packages/runtime/src/shared/hooks/codex/payloads.ts`.

### Common Codex fields

All Codex events include `session_id`, `cwd`, `hook_event_name`, `model`.
Turn-scoped events (`PreToolUse`, `PermissionRequest`, `PostToolUse`,
`UserPromptSubmit`, `Stop`) additionally include `turn_id`.

The reader layer exposes these as three nested interfaces:

```typescript
interface CodexSessionContextBase {
  sessionId: string;
  cwd?: string;
  transcriptPath?: string;
  model?: string;
}

interface CodexTurnContextBase extends CodexSessionContextBase {
  turnId?: string;
}

interface CodexToolContextBase extends CodexTurnContextBase {
  toolName: string;
  toolInput: object;
  toolUseId?: string;
}
```

### Per-event differences from Claude

- `SessionStart` matchers: `startup|resume` only (no `clear|compact`).
- `PreToolUse` matcher: `Bash|apply_patch|Edit|Write` — guards every
  matched PostToolUse event with an idempotent session ensure.
- `PermissionRequest` matcher: open (no matcher).
- `PostToolUse` matchers: `Bash` (separate handler), `apply_patch|Edit|Write`
  (routes to `PostToolUse/ApplyPatch.ts`), and `mcp__.*`
  (routes to `PostToolUse/Mcp.ts`).
- `Stop` carries `stop_hook_active` (boolean) instead of Claude's `stop_reason`.
  Agent Tracer emits `stopReason: "stop_hook"` as a synthetic value since Codex
  does not expose a real reason.

### Hook ↔ rollout cross-check (Codex)

Codex's rollout JSONL stream and the official PostToolUse hooks both
surface `apply_patch` and `mcp__*` events. The adapter attaches a
`crossCheck: { source, dedupeKey }` marker to each emission — `"hook"`
from the PostToolUse handler, `"rollout"` from the rollout observer
(`packages/runtime/src/codex/app-server/observe.ts`). The server uses
`(kind, sessionId, dedupeKey)` to merge the two within a 60-second
window, so duplicates collapse into a single row.

`dedupeKey` resolution (preferred → fallback):

- `apply_patch`: `tool_use_id` ↔ `call_id` ; otherwise
  `apply_patch:<primaryFilePath>:<patchInput.length>`.
- `mcp__*`: `tool_use_id` ↔ `call_id` ; otherwise
  `<tool_name>:<turn_id>`.

`web_search_call` events still arrive only via the rollout observer
(Codex has no web hook), but the marker is attached for forward-compat.

### Codex privacy contract

The Codex adapter follows the same privacy contract as the Claude plugin:
PostToolUse handlers never read `tool_response`. The rollout observer
parses `apply_patch.input` only to extract touched file paths from
`*** Add File:` / `*** Update File:` / `*** Delete File:` / `*** Move to:`
headers; the diff body itself is never stored.
- `UserPromptSubmit` has no `cwd`/`transcript_path` guarantees — only
  `session_id`, `prompt`, `model`, `turn_id`.

### PermissionRequest

Posts a `rule.logged` event with `ruleStatus: "requested"`,
`ruleOutcome: "observed"`, and `rulePolicy: "codex_permission"`. Agent Tracer
is observation-only and never sets `decision.behavior` — Codex uses its
built-in policy.

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
  └─ PostToolUse | PostToolUseFailure | PermissionDenied

Parallel tool batch
  └─ PostToolBatch (after every call in the batch resolves)

Agent tool execution
  ├─ PreToolUse (tool_name: "Agent")
  ├─ SubagentStart
  ├─ (tools inside subagent: PreToolUse / PostToolUse repeating)
  ├─ SubagentStop
  └─ PostToolUse (tool_name: "Agent")   ← after SubagentStop

Native task tooling
  ├─ PostToolUse (tool_name: "TaskCreate") → TaskCreated
  └─ PostToolUse (tool_name: "TaskUpdate") → TaskCompleted (on completion)

/compact execution
  ├─ PreCompact
  ├─ SubagentStart (agent_type: "")     ← compact-specific internal agent
  ├─ SubagentStop  (agent_type: "")
  └─ PostCompact

Session end
  └─ Stop | StopFailure
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
| `SubagentStop` | Calls `POST /ingest/v1/sessions/end` for the virtual session with `completeTask: false`; cursor for `sub--{agentId}` is deleted |

---

## Code Implementation Notes

| Situation | Current | Recommended |
|-----------|---------|------------|
| `transcript_path` usage | Captured when present | Do not rely on, may be missing |
| `agent_type` default | `\|\| "unknown"` | Preserve as `\|\| ""` to distinguish compact agents |
| `custom_instructions` empty | `\|\| ""` (already handled) | Keep current code |
| `compact_summary` logging | - | Length limit required (several KB) |
| `tool_response` logging | Redacted in hookLogPayload | Preserve |
| `session_id` in subagent hooks | Parent's session_id is always sent | Use `agent_id` + `resolveEventSessionIds` to route to child task |
| Validation | Payload readers in `~shared/hooks/{claude,codex}/payloads.ts`; never throw, return `{ ok: false, reason }` on missing required fields | Add new events by defining a reader + invoking `runHook(name, { logger, parse, handler })` |
