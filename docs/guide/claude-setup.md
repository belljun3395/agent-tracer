# Claude Code Setup

This page covers the Claude Code specific steps needed after the shared
[install-and-run](./install-and-run.md) flow.

Agent Tracer ships as a Claude Code **plugin** (`.claude/plugin/`). The plugin
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
claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin
```

As a shell alias:

```bash
alias claude='claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin'
```

### Permanent install via marketplace

For a persistent install, Agent Tracer publishes a marketplace at the repo
root (`.claude-plugin/marketplace.json`). From any Claude Code session:

```bash
/plugin marketplace add belljun3395/agent-tracer
/plugin install agent-tracer-monitor@agent-tracer
```

Updates land automatically. Whenever
`.claude/plugin/.claude-plugin/plugin.json#version` changes (CI auto-bumps
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
  node /absolute/path/to/agent-tracer/packages/adapter-mcp/dist/index.js
```

If Claude is launched from a GUI and `node` is not on the GUI PATH, use an
absolute Node binary path instead of plain `node`.

Verify registration:

```bash
claude mcp list
```

Expected result: `monitor` is listed and connected.

## 4. What the hooks do

Hook scripts live under `.claude/plugin/hooks/`, registered through
`.claude/plugin/hooks/hooks.json` and executed by
`.claude/plugin/bin/run-hook.sh`. Each file name matches the Claude Code
hook event name.

### Top-level hook files

| File | Event | Responsibility |
|------|-------|----------------|
| `SessionStart.ts` | `SessionStart` | Ensure a runtime session, record clear/resume markers |
| `UserPromptSubmit.ts` | `UserPromptSubmit` | Record the raw user prompt as `user.message` |
| `PreToolUse.ts` | `PreToolUse` | Ensure a runtime session exists before a tool fires |
| `PostToolUseFailure.ts` | `PostToolUseFailure` | Record failed tool activity |
| `SubagentStart.ts` | `SubagentStart` | Register background subagent start |
| `SubagentStop.ts` | `SubagentStop` | Register background subagent completion |
| `PreCompact.ts` | `PreCompact` | Record compaction checkpoint (planning lane) |
| `PostCompact.ts` | `PostCompact` | Record compaction summary |
| `SessionEnd.ts` | `SessionEnd` | Close the current runtime session only |
| `Stop.ts` | `Stop` | Record assistant response and end runtime session with `completeTask: true` |

### `PostToolUse/` — per-tool subhandlers

`PostToolUse` is routed to one of six sub-handlers via the matchers in
`hooks.json`. All sub-handlers post to `POST /ingest/v1/events` with a
`kind`-tagged envelope; lane, subtype, toolFamily, and operation are
derived **server-side** by `@monitor/classification` at ingestion
(v0.2.0+).

| Matcher | File | `kind` |
|---------|------|--------|
| `Bash` | `PostToolUse/Bash.ts` | `terminal.command` |
| `Edit\|Write` | `PostToolUse/File.ts` | `tool.used` |
| `Read\|Glob\|Grep\|WebSearch\|WebFetch` | `PostToolUse/Explore.ts` | `tool.used` |
| `Agent\|Skill` | `PostToolUse/Agent.ts` | `agent.activity.logged` |
| `TaskCreate\|TaskUpdate\|TodoWrite` | `PostToolUse/Todo.ts` | `todo.logged` (batch) |
| `mcp__.*` | `PostToolUse/Mcp.ts` | `agent.activity.logged` |

### Supporting modules

- `lib/` — shared utilities (`transport`, `session`, `subagent-session`, `transcript-cursor`, `transcript-tail`, `transcript-emit`, `json-file-store`, `hook-log`)
- `util/` — framework-agnostic helpers (`lane`, `paths`, `utils`)

> Pre-v0.2.0 the plugin also maintained `lib/session-cache.ts`,
> `lib/session-history.ts`, `lib/session-metadata.ts`, and a
> `classification/` directory. All were removed in Phase 6 — the server
> owns session state (idempotent ensure) and semantic classification.

### Session vs. task lifecycle

| Event | Hook | Effect |
|-------|------|--------|
| Session cleared / resumed / first prompt | `SessionStart.ts` + `UserPromptSubmit.ts` | Ensure runtime session, record raw user prompt |
| First tool use | `PreToolUse.ts` | Reuses the ensured runtime session |
| Tool success | `PostToolUse/*.ts` | Capture per-tool activity as raw payload (server classifies) |
| Tool failure | `PostToolUseFailure.ts` | Record the failed tool call |
| Subagent lifecycle | `SubagentStart.ts`, `SubagentStop.ts` | Record background running / completed markers |
| Pre/Post compact | `PreCompact.ts`, `PostCompact.ts` | Record compaction checkpoint and compact summary |
| Assistant turn end | `Stop.ts` | Record assistant response and call `/api/runtime-session-end` with `completeTask: true` |
| Session end | `SessionEnd.ts` | Ends only the current runtime session unless `Stop.ts` already completed the primary task |
| Work item complete | `monitor_task_complete` MCP tool | Marks the task `completed` |

## 5. Working inside this repository

If you are running Claude Code *inside* the Agent Tracer repo itself, you
don't need `setup:external`. Just launch:

```bash
claude --plugin-dir .claude/plugin
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

When hooks aren't enough, the `monitor` MCP server exposes 24 tools you can
call directly. A few of the most useful ones:

- Task lifecycle: `monitor_task_start`, `monitor_task_complete`, `monitor_task_error`, `monitor_task_link`
- Runtime session lifecycle: `monitor_runtime_session_ensure`, `monitor_runtime_session_end`, `monitor_session_end`
- Conversation: `monitor_user_message` (requires `messageId`; `captureMode: "derived"` requires `sourceEventId`), `monitor_assistant_response`
- Event logging: `monitor_tool_used`, `monitor_terminal_command`, `monitor_explore`, `monitor_save_context`, `monitor_plan`, `monitor_action`, `monitor_verify`, `monitor_rule`, `monitor_question`, `monitor_thought`, `monitor_todo`, `monitor_agent_activity`
- Background: `monitor_async_task`
- Workflow library: `monitor_evaluate_task`, `monitor_find_similar_workflows`

See [MCP Tool Reference](/wiki/mcp-tool-reference) for the full list.

## 8. End-to-end check

1. Monitor server is running (`curl -sf http://127.0.0.1:3847/api/overview`).
2. `setup:external` has been run for the target project.
3. `monitor` is registered in `claude mcp list`.
4. Open the target project with
   `claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin` (or
   your alias).
5. Perform one read or edit.
6. Confirm a task appears in the dashboard at `http://127.0.0.1:5173`.
7. Finish the Claude turn. Confirm the primary task transitions to
   `completed` unless background descendants are still running.
