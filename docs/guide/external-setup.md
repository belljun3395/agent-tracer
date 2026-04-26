# External Project Setup

This page is where you go after [install-and-run.md](./install-and-run.md)
when you want to attach Agent Tracer to **another project** — not the
agent-tracer repo itself.

## 1. What is supported today

| Runtime | Automated setup | Still manual | Next doc |
|---------|-----------------|--------------|----------|
| Claude Code | yes (`npm run setup:external`) | MCP server registration | [claude-setup.md](./claude-setup.md) |
| Codex | yes (`npm run setup:external`) | none for the normal interactive path | [codex-setup.md](./codex-setup.md) |
| Other runtimes | no | HTTP + MCP calls directly | [runtime-capabilities.md](./runtime-capabilities.md) |

Important points:

- `setup:external` now bootstraps both Claude Code and Codex.
- It does **not** vendor hook source files or install a permanent Codex plugin,
  because Codex does not expose an equivalent plugin surface today.
- The Agent Tracer source stays in *this* repository. The target project gets
  generated config files and runtime references back to this checkout.

## 2. Prerequisites

- You have already finished [install-and-run.md](./install-and-run.md).
- The monitor server is running and `curl -sf http://127.0.0.1:3847/api/v1/overview` returns 200.
- You have a target project path (e.g. `/absolute/path/to/your-project`).
- For Claude Code, you can launch the `claude` CLI in that target directory.

## 3. Run `setup:external`

From the Agent Tracer repository root:

```bash
npm run build                       # only needed if you haven't built yet
npm run setup:external -- --target /absolute/path/to/your-project
```

The only required argument is `--target`. The script currently bootstraps:

1. Claude Code
   - creates or merges `target-project/.claude/settings.json`
   - strips any legacy `hooks` block (the plugin owns registration now)
   - sets `permissions.defaultMode = "acceptEdits"` and
     `permissions.allow = ["WebSearch", "WebFetch"]`
   - prints the absolute path of the Agent Tracer plugin and the
     `claude --plugin-dir …` command to use
2. Codex
   - creates or merges `target-project/.codex/config.toml`
   - creates or merges `target-project/.codex/hooks.json`
   - enables repo-local Codex hooks for plain `codex` usage
   - registers `SessionStart`, `UserPromptSubmit`, `PreToolUse(Bash)`,
     `PostToolUse(Bash)`, and `Stop`

Expected output:

```text
[claude] Plugin path: /absolute/path/to/agent-tracer/packages/runtime/src/claude-code
[claude] Run Claude Code with: claude --plugin-dir /absolute/path/to/agent-tracer/packages/runtime/src/claude-code
```

> The script also parses `--monitor-base-url`, `--source-repo`,
> `--source-ref`, and `--source-root`, but these are not currently used
> for vendoring — the plugin is referenced directly from this repository.

## 4. Attach Claude Code

Follow [claude-setup.md](./claude-setup.md) sections 2 and 3 to:

1. Launch Claude Code with `claude --plugin-dir …` (or via the marketplace).
2. Register the `monitor` MCP server with `claude mcp add monitor …`.

## 5. Attach Codex

Follow [codex-setup.md](./codex-setup.md).

After setup, the intended flow is simply:

```bash
cd /abs/path/to/target
codex
```

The generated `.codex/config.toml` enables `codex_hooks`, and `.codex/hooks.json`
provides the monitor hook commands.

## 6. Attach other runtimes (manual)

There is no automated bootstrap for non-Claude runtimes. Instead, call
Agent Tracer's HTTP API or MCP tools directly. Minimum implementation
order:

1. `/ingest/v1/sessions/ensure` (or `/ingest/v1/tasks/start`)
2. `/ingest/v1/conversation` (`user.message`)
3. `/ingest/v1/tool-activity` (`tool.used`)
4. `/ingest/v1/tool-activity` (exploration or terminal events)
5. `/ingest/v1/conversation` (`assistant.response`)
6. `/ingest/v1/sessions/end`

Add `/ingest/v1/workflow`, `/ingest/v1/coordination`, `/ingest/v1/lifecycle`,
`/ingest/v1/telemetry`, and `/ingest/v1/tasks/link` as the runtime's capability allows.

References:

- [api-integration-map.md](./api-integration-map.md) — every endpoint
  mapped to the hook that calls it and its manual-runtime meaning
- [runtime-api-flow-and-preprocessing.md](./runtime-api-flow-and-preprocessing.md)
  — preprocessing rules applied inside each endpoint
- [runtime-capabilities.md](./runtime-capabilities.md) — what capability
  flags mean when you register a new runtime

## 7. Common pitfalls

- **Stale `npm run build`** — after modifying the MCP server entry under
  `packages/server` or the plugin, rebuild before launching Claude.
- **Missing `node` on GUI PATH** — when launching Claude Code from a
  macOS launcher, use the absolute node binary path in `claude mcp add`.
- **Env vars not inherited** — Claude Code launched from a GUI does not
  see shell env vars; launch it from a terminal, or use
  `launchctl setenv` on macOS.
- **Changes to `.claude/settings.json`** — restart Claude Code after
  editing so it picks up the new permissions and plugin path.
- **Running plain `codex` without repo-local config** — hooks are only
  guaranteed when `codex_hooks` is enabled. `setup:external` writes
  `.codex/config.toml` so plain `codex` in the target project uses hooks by default.
- **Expecting hook parity with Claude Code** — Codex hooks currently intercept
  Bash directly. File edits, MCP calls, and web search/fetch are observed from
  rollout JSONL after Codex writes those response items.

## 8. Quick end-to-end check

1. Monitor server running and healthy.
2. `npm run setup:external -- --target /abs/path/to/target`.
3. `claude mcp add monitor …` completed.
4. Run `codex` inside the target project and trigger one Bash command.
5. Open the target project with `claude --plugin-dir …`.
6. Do one read or edit inside Claude.
7. The dashboard at `http://127.0.0.1:5173` shows a new task with the
   matching event in its timeline.
