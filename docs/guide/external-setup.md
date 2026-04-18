# External Project Setup

This page is where you go after [install-and-run.md](./install-and-run.md)
when you want to attach Agent Tracer to **another project** — not the
agent-tracer repo itself.

## 1. What is supported today

| Runtime | Automated setup | Still manual | Next doc |
|---------|-----------------|--------------|----------|
| Claude Code | yes (`npm run setup:external`) | MCP server registration | [claude-setup.md](./claude-setup.md) |
| Other runtimes | no | HTTP + MCP calls directly | [runtime-capabilities.md](./runtime-capabilities.md) |

Important points:

- `setup:external` only touches Claude Code settings today.
- It does **not** copy hook source files, bootstrap custom runtimes, or
  install the plugin permanently into the target project.
- The Agent Tracer source stays in *this* repository. The target project
  only gets a `.claude/settings.json` and (via `--plugin-dir`) a runtime
  reference to the plugin path.

## 2. Prerequisites

- You have already finished [install-and-run.md](./install-and-run.md).
- The monitor server is running and `curl -sf http://127.0.0.1:3847/api/overview` returns 200.
- You have a target project path (e.g. `/absolute/path/to/your-project`).
- For Claude Code, you can launch the `claude` CLI in that target directory.

## 3. Run `setup:external`

From the Agent Tracer repository root:

```bash
npm run build                       # only needed if you haven't built yet
npm run setup:external -- --target /absolute/path/to/your-project
```

The only required argument is `--target`. The script:

1. creates or merges `target-project/.claude/settings.json`
2. strips any legacy `hooks` block (the plugin owns registration now)
3. sets `permissions.defaultMode = "acceptEdits"` and
   `permissions.allow = ["WebSearch", "WebFetch"]`
4. prints the absolute path of the Agent Tracer plugin and the
   `claude --plugin-dir …` command to use

Expected output:

```text
[claude] Plugin path: /absolute/path/to/agent-tracer/.claude/plugin
[claude] Run Claude Code with: claude --plugin-dir /absolute/path/to/agent-tracer/.claude/plugin
```

> The script also parses `--monitor-base-url`, `--source-repo`,
> `--source-ref`, and `--source-root`, but these are not currently used
> for vendoring — the plugin is referenced directly from this repository.

## 4. Attach Claude Code

Follow [claude-setup.md](./claude-setup.md) sections 2 and 3 to:

1. Launch Claude Code with `claude --plugin-dir …` (or via the marketplace).
2. Register the `monitor` MCP server with `claude mcp add monitor …`.

## 5. Attach other runtimes (manual)

There is no automated bootstrap for non-Claude runtimes. Instead, call
Agent Tracer's HTTP API or MCP tools directly. Minimum implementation
order:

1. `/api/runtime-session-ensure` (or `/api/task-start`)
2. `/api/user-message`
3. `/api/tool-used`
4. `/api/explore`
5. `/api/assistant-response`
6. `/api/runtime-session-end` (or `/api/session-end`)

Add `/api/terminal-command`, `/api/todo`, `/api/save-context`,
`/api/agent-activity`, `/api/async-task`, `/api/task-link`,
`/api/question`, and `/api/thought` as the runtime's capability allows.

References:

- [api-integration-map.md](./api-integration-map.md) — every endpoint
  mapped to the hook that calls it and its manual-runtime meaning
- [runtime-api-flow-and-preprocessing.md](./runtime-api-flow-and-preprocessing.md)
  — preprocessing rules applied inside each endpoint
- [runtime-capabilities.md](./runtime-capabilities.md) — what capability
  flags mean when you register a new runtime

## 6. Common pitfalls

- **Stale `npm run build`** — after modifying `packages/adapter-mcp` or the
  plugin, rebuild before launching Claude.
- **Missing `node` on GUI PATH** — when launching Claude Code from a
  macOS launcher, use the absolute node binary path in `claude mcp add`.
- **Env vars not inherited** — Claude Code launched from a GUI does not
  see shell env vars; launch it from a terminal, or use
  `launchctl setenv` on macOS.
- **Changes to `.claude/settings.json`** — restart Claude Code after
  editing so it picks up the new permissions and plugin path.

## 7. Quick end-to-end check

1. Monitor server running and healthy.
2. `npm run setup:external -- --target /abs/path/to/target`.
3. `claude mcp add monitor …` completed.
4. Open the target project with `claude --plugin-dir …`.
5. Do one read or edit inside Claude.
6. The dashboard at `http://127.0.0.1:5173` shows a new task with the
   matching event in its timeline.
