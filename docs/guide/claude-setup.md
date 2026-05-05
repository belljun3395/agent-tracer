# Claude Code Setup

This page covers the Claude Code specific steps needed after the shared
[install-and-run](./install-and-run.md) flow.

Agent Tracer ships as a Claude Code **plugin** (`packages/runtime/`). The plugin
registers every hook event for you and posts events to the local monitor
server. You do not copy hook source files into your target project.

## 1. Prerequisites

Before following this page, make sure that:

- the monitor server is running (`npm run dev:server`, see [install-and-run](./install-and-run.md))
- you have Claude Code installed and working

> **For external projects:** If you want to attach Agent Tracer to a project
> outside this repository, run [External Project Setup](./external-setup.md)'s
> `setup:external` first to auto-generate `.claude/settings.json`. When running
> Claude Code inside the Agent Tracer repository itself, this step is not needed.

## 2. Launch Claude Code with the plugin

As a one-off from your target project:

```bash
claude --plugin-dir /absolute/path/to/agent-tracer/packages/runtime/src/claude-code
```

As a shell alias:

```bash
alias claude='claude --plugin-dir /absolute/path/to/agent-tracer/packages/runtime/src/claude-code'
```

### Permanent install via marketplace

For a persistent install, Agent Tracer publishes a marketplace at the repo
root (`.claude-plugin/marketplace.json`). From any Claude Code session:

```bash
/plugin marketplace add belljun3395/agent-tracer
/plugin install agent-tracer-monitor@agent-tracer
```

Updates land automatically. Whenever
`packages/runtime/.claude-plugin/plugin.json#version` changes (CI auto-bumps
the patch number when hook code lands on `main`), Claude Code refreshes the
plugin on next session start.

> **Environment variables:** the plugin reads `MONITOR_BASE_URL` (full URL,
> e.g. `http://192.168.1.10:3847`) or `MONITOR_PORT` (host-local, e.g.
> `4000`) at hook execution time. Marketplace plugins have no install-time
> configuration hook, so set these in the shell that launches Claude Code
> (`.zshrc`, `.bashrc`, or a `direnv` `.envrc`). When Claude Code is started
> from a macOS GUI launcher, environment variables from `.zshrc` are NOT
> inherited — launch Claude Code from a terminal, or set the env vars at
> the system level (`launchctl setenv MONITOR_BASE_URL …`).

## 3. Register the MCP server (separate step)

The plugin only wires hook scripts. The `monitor` MCP server must still be
added separately so Claude can call MCP tools (`monitor_plan`,
`monitor_user_message`, etc.):

```bash
claude mcp add monitor \
  -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
  node /absolute/path/to/agent-tracer/packages/server/dist/mcp.js
```

`dist/mcp.js` is produced by `npm run build`. If Claude is launched from a GUI
and `node` is not on the GUI PATH, use an absolute Node binary path instead of
plain `node`.

Verify registration:

```bash
claude mcp list
```

Expected result: `monitor` is listed and connected.

## 4. What the hooks do

Hook scripts live under `packages/runtime/src/claude-code/hooks/`, registered through
`packages/runtime/src/claude-code/hooks/hooks.json` and executed by
`packages/runtime/src/claude-code/bin/run-hook.sh`. Each file name matches the Claude Code
hook event name.

> Marketplace installs see the same files under a different root: the
> marketplace entry in `.claude-plugin/marketplace.json` points to
> `packages/runtime`, and `packages/runtime/hooks/hooks.json` +
> `packages/runtime/bin/run-hook.sh` resolve the same `.ts` files in
> `src/claude-code/hooks/` at runtime. Only the `--plugin-dir` variant targets
> `src/claude-code` directly.

### Top-level hook files

Every top-level hook file uses the shared
`runHook(name, { logger, parse, handler })` wrapper from
`packages/runtime/src/shared/hook-runtime/`. `parse` comes from the typed payload
readers in `packages/runtime/src/shared/hooks/claude/payloads.ts`. The handler
body stays thin — validation, stderr/file logging, and error swallowing all live
in the shared wrapper so hooks never block Claude Code on implementation errors.

The plugin covers **27 of 28** official Claude hook events:

| File | Event | Responsibility | async |
|------|-------|----------------|:-----:|
| `SessionStart.ts` | `SessionStart` | Ensure a runtime session, record clear/resume markers | sync |
| `Setup.ts` | `Setup` | Record `--init-only` / `--maintenance` triggers as `setup.triggered` | sync |
| `SessionEnd.ts` | `SessionEnd` | Close the current runtime session only | ✓ |
| `UserPromptSubmit.ts` | `UserPromptSubmit` | Record the raw user prompt as `user.message` | sync |
| `UserPromptExpansion.ts` | `UserPromptExpansion` | Record slash / MCP-prompt expansion as `user.prompt.expansion` | ✓ |
| `InstructionsLoaded.ts` | `InstructionsLoaded` | Record CLAUDE.md / rule-file loads | ✓ |
| `PreToolUse.ts` | `PreToolUse` | Ensure a runtime session exists before a tool fires | sync |
| `PermissionRequest.ts` | `PermissionRequest` | Record permission-dialog appearance (`permission.request`) | sync |
| `PostToolUseFailure.ts` | `PostToolUseFailure` | Record failed tool activity | ✓ |
| `PostToolBatch.ts` | `PostToolBatch` | Record parallel tool-batch boundaries | ✓ |
| `PermissionDenied.ts` | `PermissionDenied` | Record auto-mode tool-call denials (`rule.logged`) | ✓ |
| `SubagentStart.ts` | `SubagentStart` | Register background subagent start | sync |
| `SubagentStop.ts` | `SubagentStop` | Register background subagent completion | ✓ |
| `TaskCreated.ts` | `TaskCreated` | Record native-task creation (`todo.logged`, state `added`) | ✓ |
| `TaskCompleted.ts` | `TaskCompleted` | Record native-task completion (`todo.logged`, state `completed`) | ✓ |
| `PreCompact.ts` | `PreCompact` | Record compaction checkpoint (planning lane) | ✓ |
| `PostCompact.ts` | `PostCompact` | Record compaction summary | ✓ |
| `Stop.ts` | `Stop` | Record assistant response and end the runtime session with `completeTask: false` | ✓ |
| `StopFailure.ts` | `StopFailure` | Record turn errors (rate_limit, billing_error, etc.) | ✓ |
| `CwdChanged.ts` | `CwdChanged` | Record working-directory transitions | ✓ |
| `FileChanged.ts` | `FileChanged` | Record changes to watched files (matcher: `CLAUDE.md\|.env\|.envrc\|.claude/settings.json\|.claude/settings.local.json`) | ✓ |
| `WorktreeCreate.ts` | `WorktreeCreate` | Record worktree creation (`worktree.create`) | sync |
| `WorktreeRemove.ts` | `WorktreeRemove` | Record worktree removal (`worktree.remove`) | ✓ |
| `Notification.ts` | `Notification` | Record permission_prompt / idle_prompt / auth_success / elicitation_dialog | ✓ |
| `ConfigChange.ts` | `ConfigChange` | Record settings-source changes (user/project/local/policy/skills) | ✓ |
| `StatusLine.ts` | `statusLine` | Post a `context.snapshot` per API refresh (context/rate-limit/cost/model) and render a status bar string | (separate) |

Not yet handled: `TeammateIdle` (experimental agent teams), `Elicitation`,
`ElicitationResult` (MCP form input).

> **async column.** "✓" means the matching `hooks.json` entry registers
> the handler with `"async": true`, so it fires-and-forgets. Sync handlers
> run on the critical path because their effect must be observed before
> the next step (session ensure, permission decision, worktree path
> resolution, child-session linking).

### StatusLine setup

`StatusLine.ts` is wired via the plugin's `hooks.json` top-level `statusLine`
entry using `${CLAUDE_PLUGIN_ROOT}`, so it resolves automatically for both
marketplace installs and `--plugin-dir` usage. Marketplace installs do not need
a target-project copy of the Agent Tracer source; `--plugin-dir` still points at
your local checkout.

The plugin's `statusLine`:

- Writes a compact one-line status string (e.g., `[monitor] ctx 42% · 5h 13% · $0.120`) for Claude Code's status bar.
- Posts a `context.snapshot` event (lane `telemetry`) to the monitor with the model ID, context-window usage, rate-limit usage, and cost.
- The web dashboard's timeline renders this as the bottom context chart with a per-model band and compact markers.

Legacy `.claude/settings.json` files that contain an absolute-path `statusLine`
entry are stripped by `npm run setup:external` on next run, because the plugin
now owns `statusLine` registration. If you maintain such a file manually, it
takes precedence over the plugin entry.

### `PostToolUse/` — per-tool subhandlers

As of v0.3, `PostToolUse` is split **per official tool identifier** — each file
name equals the Claude Code tool name. Each handler is a thin entry file; shared
per-category logic lives in `_file.ops.ts`, `_explore.ops.ts`, `_agent.ops.ts`,
`_skill.ops.ts`, `_todo.ops.ts`, and `_shared.ts` (the common read +
resolve-session-ids wrapper).

All handlers post to `POST /ingest/v1/events` with a `kind`-tagged envelope;
lane, subtype, toolFamily, and operation are derived **server-side** inside
`@monitor/server` at ingestion.

| Matcher | File | Shared ops module | `kind` |
|---------|------|-------------------|--------|
| `Bash` | `PostToolUse/Bash.ts` | (inline) | `terminal.command` |
| `PowerShell` | `PostToolUse/PowerShell.ts` | (inline) | `terminal.command` |
| `BashOutput` | `PostToolUse/BashOutput.ts` | (inline) | `tool.used` |
| `KillShell` | `PostToolUse/KillShell.ts` | (inline) | `tool.used` |
| `Monitor` | `PostToolUse/Monitor.ts` | (inline) | `monitor.observed` |
| `Edit` | `PostToolUse/Edit.ts` | `_file.ops.ts` | `tool.used` |
| `Write` | `PostToolUse/Write.ts` | `_file.ops.ts` | `tool.used` |
| `NotebookEdit` | `PostToolUse/NotebookEdit.ts` | `_file.ops.ts` | `tool.used` |
| `Read` | `PostToolUse/Read.ts` | `_explore.ops.ts` | `tool.used` |
| `Glob` | `PostToolUse/Glob.ts` | `_explore.ops.ts` | `tool.used` |
| `Grep` | `PostToolUse/Grep.ts` | `_explore.ops.ts` | `tool.used` |
| `LSP` | `PostToolUse/LSP.ts` | (inline) | `tool.used` |
| `WebFetch` | `PostToolUse/WebFetch.ts` | `_explore.ops.ts` | `tool.used` |
| `WebSearch` | `PostToolUse/WebSearch.ts` | `_explore.ops.ts` | `tool.used` |
| `Agent` | `PostToolUse/Agent.ts` | `_agent.ops.ts` | `agent.activity.logged` |
| `Skill` | `PostToolUse/Skill.ts` | `_skill.ops.ts` | `agent.activity.logged` |
| `TaskCreate` | `PostToolUse/TaskCreate.ts` | `_todo.ops.ts` | `todo.logged` (batch) |
| `TaskUpdate` | `PostToolUse/TaskUpdate.ts` | `_todo.ops.ts` | `todo.logged` (batch) |
| `TodoWrite` | `PostToolUse/TodoWrite.ts` | `_todo.ops.ts` | `todo.logged` (batch) |
| `AskUserQuestion` | `PostToolUse/AskUserQuestion.ts` | `_explore.ops.ts` | `tool.used` (`question.logged`) |
| `ExitPlanMode` | `PostToolUse/ExitPlanMode.ts` | `_explore.ops.ts` | `plan.logged` |
| `EnterPlanMode \| EnterWorktree \| ExitWorktree` | `PostToolUse/ModeChange.ts` | (inline) | `context.saved` |
| `CronCreate \| CronDelete \| CronList` | `PostToolUse/Cron.ts` | (inline) | `agent.activity.logged` |
| `ToolSearch` | `PostToolUse/ToolSearch.ts` | (inline) | `tool.used` |
| `mcp__.*` | `PostToolUse/Mcp.ts` | (inline) | `agent.activity.logged` |

All `PostToolUse` matchers above are registered with `"async": true` in
`hooks.json` since the handler only emits an event — the agent's main
loop never waits on them.

**Privacy contract.** Every PostToolUse handler reads `tool_input` only
and ignores `tool_response`. Result bodies (stdout/stderr, file contents,
web pages, MCP results, search result lists, grep snippets) are never
collected — only quantitative wrappers like `commandAnalysis`,
`readOffset/limit`, `webPrompt`, `webAllowedDomains`, etc. survive into
the ingest event. See `packages/runtime/CLAUDE_DATA_FLOW.md` for the
per-tool metadata fields.

> Pre-v0.3 the handlers were grouped behind non-official matcher-group files
> (`File.ts`, `Explore.ts`, `Todo.ts`). They were replaced with the per-tool
> split above so file names exactly match the official Claude Code tool
> identifier. `Mcp.ts` is kept as a category handler because `mcp__*` is a
> wildcard regex, not a single tool identifier.

### Supporting modules

- `~shared/hook-runtime/` — `createHookRuntime`, `runHook`, the monitor transport
  (envelope-parsing `MonitorRequestError`), structured log writer, and the light
  `validator.ts` reader helpers
- `~shared/hooks/claude/payloads.ts` — typed payload readers per hook event
- `~shared/hooks/codex/payloads.ts` — typed payload readers for the Codex hooks
- `~shared/errors/` — `MonitorRequestError`, `RolloutNotFoundError`,
  `RolloutTimeoutError`, `MissingSessionMarkerError`
- `~shared/config/env.ts` — typed loader for `MONITOR_*`, `CLAUDE_PROJECT_DIR`,
  `CODEX_PROJECT_DIR`, `NODE_ENV`
- `lib/runtime.ts` — per-runtime `createHookRuntime({ logFile })` instance
  (`.claude/hooks.log` for Claude, `.codex/hooks.log` for Codex)
- `lib/hook/` — thin re-exports of `hookLog`, `hookLogPayload`, and the
  context readers
- `lib/transport/` — thin re-exports of `postJson`, `postEvent`,
  `postTaggedEvent`, `postTaggedEvents`, plus the runtime-specific
  `ensureRuntimeSession` with the correct `runtimeSource` + `workspacePath`
- `util/` — framework-agnostic helpers (`lane`, `paths`, `utils`)

> Pre-v0.2.0 the plugin also maintained `lib/session-cache.ts`,
> `lib/session-history.ts`, `lib/session-metadata.ts`, and a
> `classification/` directory. All were removed in Phase 6 — the server
> owns session state (idempotent ensure) and semantic classification.

### Session vs. task lifecycle

| Event | Hook | Effect |
|-------|------|--------|
| Session cleared / resumed / first prompt | `SessionStart.ts` + `UserPromptSubmit.ts` | Ensure runtime session, record raw user prompt |
| Instruction file loaded | `InstructionsLoaded.ts` | Record CLAUDE.md / rule-file load on the planning lane |
| First tool use | `PreToolUse.ts` | Reuses the ensured runtime session |
| Tool success | `PostToolUse/<Tool>.ts` | Per-tool handler captures raw payload (server classifies) |
| Parallel tool batch end | `PostToolBatch.ts` | Record the boundary between a parallel tool fan-out and the next model call |
| Tool failure | `PostToolUseFailure.ts` | Record the failed tool call |
| Tool auto-denied | `PermissionDenied.ts` | Record `rule.logged` for the auto-mode deny |
| Subagent lifecycle | `SubagentStart.ts`, `SubagentStop.ts` | Record background running / completed markers |
| Native task lifecycle | `TaskCreated.ts`, `TaskCompleted.ts` | Record TaskCreate / TaskComplete transitions as `todo.logged` |
| Pre/Post compact | `PreCompact.ts`, `PostCompact.ts` | Record compaction checkpoint and compact summary |
| Assistant turn end | `Stop.ts` | Record assistant response and call `/ingest/v1/sessions/end` with `completeTask: false` |
| Turn error | `StopFailure.ts` | Record `assistant.response` with `stopReason: "error:<error_type>"` |
| Cwd change | `CwdChanged.ts` | Record working-directory transition as `context.saved` |
| User notification | `Notification.ts` | Record permission-prompt / idle / auth-success / elicitation notifications |
| Config source change | `ConfigChange.ts` | Record settings-source mutations during the session |
| Session end | `SessionEnd.ts` | Ends the current runtime session; `prompt_input_exit` is the only automatic path that passes `completeTask: true` |
| Work item complete | `monitor_task_complete` MCP tool | Marks a known task `completed`; runtime-session closure policy stays with `monitor_runtime_session_end` |

## 5. Working inside this repository

If you are running Claude Code *inside* the Agent Tracer repo itself, you
don't need `setup:external`. Just launch:

```bash
claude --plugin-dir packages/runtime/src/claude-code
```

`.claude/settings.json` only declares `permissions`. The plugin's
`hooks/hooks.json` registers every hook event automatically. You still need
to register the `monitor` MCP server as shown in section 3.

## 6. Hook debug log

Hook scripts write a debug log to `${CLAUDE_PROJECT_DIR}/.claude/hooks.log`
**only when `NODE_ENV=development`**. The plugin's `bin/run-hook.sh` exports
`NODE_ENV=development` by default, so file logging is active whenever the
plugin is loaded.

| Environment | Logging |
|-------------|---------|
| This repo (Claude Code with plugin) | enabled |
| External project (Claude Code with plugin) | enabled |
| Direct MCP calls (no hooks involved) | not applicable |

Clear the log:

```bash
> .claude/hooks.log
```

For the payload schema and known differences from the official spec, see
[hook-payload-spec.md](./hook-payload-spec.md).

## 7. Manual MCP tools

When hooks aren't enough, the `monitor` MCP server exposes these tools you can
call directly. A few of the most useful ones:

- Task lifecycle: `monitor_task_start`, `monitor_task_complete`, `monitor_task_error`, `monitor_task_link`
- Runtime session lifecycle: `monitor_runtime_session_ensure`, `monitor_runtime_session_end`
- Conversation: `monitor_user_message` (requires `messageId`; `captureMode: "derived"` requires `sourceEventId`), `monitor_assistant_response`
- Event logging: `monitor_tool_used`, `monitor_terminal_command`, `monitor_explore`, `monitor_save_context`, `monitor_plan`, `monitor_action`, `monitor_verify`, `monitor_rule`, `monitor_question`, `monitor_thought`, `monitor_todo`, `monitor_agent_activity`
- Background: `monitor_async_task`

## 8. End-to-end check

1. Monitor server is running (`curl -sf http://127.0.0.1:3847/api/v1/overview`).
2. `setup:external` has been run for the target project.
3. `monitor` is registered in `claude mcp list`.
4. Open the target project with
   `claude --plugin-dir /absolute/path/to/agent-tracer/packages/runtime/src/claude-code` (or
   your alias).
5. Perform one read or edit.
6. Confirm a task appears in the dashboard at `http://127.0.0.1:5173`.
7. Finish the Claude turn. Confirm an `assistant.response` event appears. The
   primary task stays open across turns unless you explicitly exit the Claude
   session or complete the task through `monitor_task_complete`.
