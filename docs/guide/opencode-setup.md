# Agent Tracer - OpenCode Setup Guide

This guide is for OpenCode only.

If you want to attach Agent Tracer to another project, start with
[external-setup.md](./external-setup.md) first. This page covers the
OpenCode-specific steps after the shared setup flow.

## 1. What `setup:external --mode opencode` automates

The script:

- writes or merges `target-project/opencode.json`
- registers the `monitor` MCP entry in that config
- creates `target-project/.opencode/plugins/monitor.ts`
- creates `target-project/.opencode/tsconfig.json`
- vendors `.opencode/plugins/monitor.ts` into `target-project/.agent-tracer/.opencode/plugins/monitor.ts`
- makes the target plugin file re-export that vendored plugin

By default, vendored source files come from the public repository `main` branch.

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
npm run setup:external -- --target /path/to/your-project --mode opencode
```

After that, the target project should contain:

- `opencode.json` with a `monitor` MCP entry
- `.opencode/plugins/monitor.ts` shim pointing to `../../.agent-tracer/.opencode/plugins/monitor.ts`
- `.opencode/tsconfig.json` so IDEs type-check the plugin shim with modern TS settings

In the common case, that is enough. Open the target project in OpenCode and the
plugin path should activate automatically.

## 4. What The Plugin Does

The plugin is the default automatic monitoring path for OpenCode.

It observes:

- direct plugin hooks: `chat.message`, `command.execute.before`, `tool.execute.before`, `tool.execute.after`
- documented event stream entries: `session.created`, `message.updated`, `session.idle`, `command.executed`, `tui.command.execute`, `session.deleted`
- additional typed SDK event used for shutdown cleanup: `server.instance.disposed`

**Session vs. task lifecycle:**

| Task kind | `session.deleted` behavior |
|-----------|-----------------------------|
| `primary` | sends `completeTask:true` and the task usually becomes `completed` |
| `background` | tries to keep background lineage correct and lets the server complete the last session |

The plugin also:

- records raw user prompt text from the typed `chat.message` hook
- preserves wrapped OpenCode payloads such as Oh My OpenCode message shapes
- can call semantic tools such as `monitor_question`, `monitor_todo`, `monitor_thought`, and `monitor_task_link` when extra observability is useful

The OpenCode docs event table does not currently list every typed hook surface.
`chat.message` and `command.execute.before` come from the plugin hook interface,
and `server.instance.disposed` comes from the SDK event union.

## 5. Repo-local Setup In This Repository

This repository already includes:

- `.opencode/plugins/monitor.ts`
- `.opencode/tsconfig.json`
- `opencode.json`

So when you open **this repository itself** in OpenCode, the repo-local path is
already configured.

## 6. Manual MCP Fallback

If the plugin path is unavailable in your environment, you can still register
the MCP server manually.

Use Node.js 18+ for the MCP process:

```bash
npm run build --workspace @monitor/mcp
```

Then register:

```bash
opencode mcp add
```

Use these values:

- Name: `monitor`
- Type: `local`
- Command:

```bash
node /path/to/agent-tracer/packages/mcp/dist/index.js
```

Set `MONITOR_BASE_URL=http://127.0.0.1:3847` in the MCP server environment.

Verify registration:

```bash
opencode mcp list
```

Expected result: `monitor` is listed as `connected`.

## 7. End-To-End Check

1. Start the monitor server.
2. Run `setup:external --mode opencode` for the target project.
3. Open the target project in OpenCode.
4. Run one normal task.
5. Confirm task and event activity appears in the dashboard.
6. End the OpenCode session and confirm the task transitions cleanly.
