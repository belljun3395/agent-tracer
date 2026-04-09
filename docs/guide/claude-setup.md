# Agent Tracer - Claude Code Setup Guide

This guide is for Claude Code only.

If you want to attach Agent Tracer to another project, start with
[external-setup.md](./external-setup.md) first (official mirror:
https://belljun3395.github.io/agent-tracer/guide/external-setup). This page covers the
Claude-specific steps after the shared setup flow.

## 1. What `setup:external --mode claude` automates

Agent Tracer is now a Claude Code **plugin** (`.claude/plugin/`). The
setup script no longer vendors hook scripts; it just prepares the target
project's `.claude/settings.json` and prints how to launch Claude Code with the
plugin.

The script:

- creates or merges `target-project/.claude/settings.json`
- adds a `permissions` block so `WebSearch` and `WebFetch` are allowed by default
- **strips** any legacy `hooks` block from a pre-existing `settings.json` (the
  plugin owns hook registration now — leaving stale entries would double-fire
  events)
- prints the absolute path of the Agent Tracer plugin (`.claude/plugin/`)
  along with the `claude --plugin-dir <path>` command and an alias suggestion

The script does **not**:

- register the Claude MCP server for you
- vendor any hook source files into the target project
- install the plugin permanently (use `--plugin-dir` for now; a marketplace
  install path is tracked separately)
- force a globally unsafe `bypassPermissions` mode

## Permission defaults

The generated Claude settings use a conservative default:

- `permissions.defaultMode = "acceptEdits"`
- `permissions.allow = ["WebSearch", "WebFetch"]`

This keeps normal edit flows working while avoiding repeated approval prompts for
web lookups that Agent Tracer wants to observe. If you need a stricter or more
permissive policy, adjust `.claude/settings.json` after installation.

## 2. Verify The Monitor Server

```bash
curl -sf http://127.0.0.1:${MONITOR_PORT:-3847}/api/overview | python3 -m json.tool
```

If the request fails, start the server:

```bash
npm run dev:server
# or
npm run build && npm run start:server
```

## 3. External Project Setup

From the Agent Tracer repository root:

```bash
npm run build
npm run setup:external -- --target /path/to/your-project --mode claude
```

The script prints the plugin path. Launch Claude Code with the plugin enabled
either as a one-off:

```bash
claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin
```

…or by aliasing it once in your shell rc:

```bash
alias claude='claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin'
```

### Permanent install via marketplace

For a persistent install, Agent Tracer publishes a marketplace at the repo root
(`.claude-plugin/marketplace.json`). From any Claude Code session:

```bash
/plugin marketplace add belljun3395/agent-tracer
/plugin install agent-tracer-monitor@agent-tracer
```

Updates land automatically: every time `.claude/plugin/.claude-plugin/plugin.json#version`
changes (CI auto-bumps the patch number when hook code lands on `main`), Claude
Code refreshes the plugin on next session start.

> **Configuration:** the plugin reads `MONITOR_BASE_URL` (full URL, e.g.
> `http://192.168.1.10:3847`) or `MONITOR_PORT` (host-local, e.g. `4000`) at
> hook execution time. Marketplace plugins have no install-time configuration
> hook, so set these in the shell that launches Claude Code (`.zshrc`,
> `.bashrc`, or a `direnv` `.envrc`). When Claude Code is started from a macOS
> GUI launcher, environment variables from `.zshrc` are NOT inherited — launch
> Claude Code from a terminal, or set the env vars at the system level
> (`launchctl setenv MONITOR_BASE_URL …`).

### MCP server (separate registration)

The marketplace install only registers hook scripts. The `monitor` MCP server
must still be added separately so Claude can call MCP tools (`monitor_plan`,
`monitor_user_message`, etc.):

```bash
claude mcp add monitor \
  -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
  node /absolute/path/to/agent-tracer/packages/mcp/dist/index.js
```

If Claude is launched from a GUI and `node` is not on the GUI PATH, use an
absolute Node binary path instead of plain `node`.

Verify registration:

```bash
claude mcp list
```

Expected result: `monitor` is listed and connected.

## 4. What The Hooks Do

Hook scripts now live under the plugin package, registered through
`.claude/plugin/hooks/hooks.json` and executed by
`.claude/plugin/bin/run-hook.sh`:

- `.claude/plugin/hooks/session_start.ts`
- `.claude/plugin/hooks/user_prompt.ts`
- `.claude/plugin/hooks/ensure_task.ts`
- `.claude/plugin/hooks/terminal.ts`
- `.claude/plugin/hooks/tool_used.ts`
- `.claude/plugin/hooks/explore.ts`
- `.claude/plugin/hooks/agent_activity.ts`
- `.claude/plugin/hooks/todo.ts`
- `.claude/plugin/hooks/compact.ts`
- `.claude/plugin/hooks/subagent_lifecycle.ts`
- `.claude/plugin/hooks/session_end.ts`
- `.claude/plugin/hooks/stop.ts`

Behavior:

- create or resume a runtime session through `/api/runtime-session-ensure`
- capture raw user prompt text via `UserPromptSubmit`
- capture successful and failed tool activity, including MCP tool names
- capture Agent and Skill activity plus subagent start/stop lifecycle
- capture compaction markers and compact summaries
- post assistant turn output and complete the task on `Stop`
- end only the current runtime session on `SessionEnd` and skip clear events
- store transient subagent registry data in `${CLAUDE_PROJECT_DIR}/.claude/.subagent-registry.json`

**Session vs. task lifecycle:**

| Event | Hook | Effect |
|-------|------|--------|
| Session cleared / first prompt | `session_start.ts`, `user_prompt.ts` | Record clear markers + ensure runtime task + record raw user prompt |
| First tool use | `ensure_task.ts` | Reuses the ensured runtime session |
| Tool success / failure | `terminal.ts`, `tool_used.ts`, `explore.ts`, `agent_activity.ts`, `todo.ts` | Capture command, edit, explore, MCP, subagent launch, and task-list activity |
| Subagent lifecycle | `subagent_lifecycle.ts` | Record subagent running/completed async lifecycle events |
| Pre/Post compact | `compact.ts` | Record compaction checkpoint and compact summary |
| Assistant turn end | `stop.ts` | Record assistant response and call `/api/runtime-session-end` with `completeTask: true` |
| Session end | `session_end.ts` | Ends only the current runtime session unless `stop.ts` already completed the primary task |
| Work item complete | `monitor_task_complete` MCP tool | Marks the task `completed` |

## 5. Repo-local Setup In This Repository

When working inside this repository, run Claude Code with the bundled plugin:

```bash
claude --plugin-dir .claude/plugin
```

`.claude/settings.json` only declares `permissions`. The plugin's
`hooks/hooks.json` registers every hook event automatically.

You still need the `monitor` MCP server registered in Claude Code.

## 6. Hook Debug Log

Hook scripts write a debug log to `${CLAUDE_PROJECT_DIR}/.claude/hooks.log`
**only when `NODE_ENV=development`**. The plugin's `bin/run-hook.sh` exports
`NODE_ENV=development` by default, so file logging is active whenever the
plugin is loaded.

| Environment | Logging |
|-------------|---------|
| This repo (Claude Code with plugin) | ✅ enabled |
| External project (Claude Code with plugin) | ✅ enabled |
| `scripts/test-hooks.ts` (calls monitor API directly) | ❌ not applicable |
| Docker (`scripts/start-docker.sh`) | ❌ hooks do not run inside Docker |

To clear the log:

```bash
> .claude/hooks.log
```

For the payload schema and known differences from the official spec, see
[hook-payload-spec.md](./hook-payload-spec.md).

## 7. Manual MCP Tools

If hooks are not enough, you can still call MCP tools directly.

Common lifecycle tools:

- `monitor_task_start`
- `monitor_task_complete`
- `monitor_task_error`
- `monitor_session_end`

Canonical user message path:

- `monitor_user_message`
  - `messageId` is required
  - `captureMode: "derived"` requires `sourceEventId`

Planning / event logging tools:

- `monitor_save_context`
- `monitor_tool_used`
- `monitor_terminal_command`
- `monitor_plan`
- `monitor_action`
- `monitor_verify`
- `monitor_rule`
- `monitor_explore`
- `monitor_async_task`

## 8. End-To-End Check

1. Start the monitor server.
2. Run `setup:external --mode claude` for the target project.
3. Register `monitor` in `claude mcp add`.
4. Open the target project with `claude --plugin-dir <agent-tracer>/.claude/plugin` (or your alias).
5. Perform one read or edit action.
6. Confirm a task appears in the dashboard.
7. Stop the Claude turn and confirm the primary task transitions to `completed` unless background descendants are still running.
