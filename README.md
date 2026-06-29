# Agent Tracer

A local monitor server and dashboard for coding-agent runtimes.
This repository ships a Claude Code plugin-based event collection path and a
Codex bootstrap path based on official hooks.
The server and MCP layers are also open to manual HTTP/MCP clients.

## Quick Start

Agent Tracer currently supports:

- Claude Code via plugin
- Codex via generated repo-local hooks and repo-local config

**Prerequisites:** Node.js 25+ and npm 11+ (see `.nvmrc`), Docker (for the
bundled Postgres + Redis), and `git`.

The monitor server needs **Postgres** (primary store) and **Redis** (WebSocket
pub/sub) running before `npm run dev`. The repo ships a `docker-compose.yml`
with both; `npm run infra:up` starts them in the background.

```bash
npm install
npm run build
npm run infra:up   # start Postgres + Redis (requires Docker)
npm run dev
```

### Two install modes

Pick one — they are independent and should not be combined.

| Mode | Who it's for | Claude Code | Codex | Status line |
|------|--------------|-------------|-------|-------------|
| **A. Marketplace plugin** | Just want Claude Code observability, no clone needed | `/plugin install agent-tracer-monitor@agent-tracer` | not supported (no plugin surface yet) | `bash ~/.claude/plugins/marketplaces/agent-tracer/scripts/install-statusline.sh` |
| **B. Local clone + `setup:external`** | Want Codex too, or want to hack on the runtime | `claude --plugin-dir <clone>/packages/runtime` (printed by the script) | `.codex/hooks.json` written into your target project | served by the plugin's `statusLine`; the wrapper script is unnecessary |

Mode B is what the rest of this README assumes unless noted. Mode A users
can stop after `/plugin install` + `install-statusline.sh`.

### Minimal setup path (Mode B)

1. Clone the repo, then `npm install`, `npm run build`, `npm run infra:up`,
   `npm run dev` (see [Running this repository locally](#running-this-repository-locally)).
   Verify with `curl -sf http://127.0.0.1:3847/health` and open
   http://127.0.0.1:5173.
2. **Claude Code.** Load the plugin, then register the MCP server separately —
   the plugin only wires hooks; the `monitor` MCP server is added on its own and
   needs a prior `npm run build` so `dist/mcp.js` exists:

   ```bash
   claude --plugin-dir packages/runtime
   claude mcp add monitor \
     -e MONITOR_BASE_URL=http://127.0.0.1:3847 \
     node "$(pwd)/packages/server/api-gateway/dist/mcp.js"
   ```

   Check with `claude mcp list` — `monitor` should be listed and connected.
3. **Codex.** Codex has no plugin surface, so generate the repo-local hooks
   first, then run Codex:

   ```bash
   npm run setup:external -- --target "$(pwd)"
   codex
   ```

To attach Agent Tracer to a project **outside** this repository, run
`npm run setup:external -- --target /absolute/path/to/your-project`; it writes
`.claude/settings.json`, `.codex/config.toml`, and `.codex/hooks.json` (and
prints the `claude --plugin-dir` command) into that project.

### Global status line (Mode A only)

Claude Code plugins can register hook events but **cannot** register a
`statusLine` (it is a `settings.json`-only field). For Mode A
(marketplace) installs, install the wrapper once globally to get the
`[monitor] ctx N% · 5h N% · $X` segment in *every* project:

```bash
# After installing the agent-tracer-monitor plugin via Claude Code
npm run setup:statusline
# or, without npm:
bash ~/.claude/plugins/marketplaces/agent-tracer/scripts/install-statusline.sh
```

The script is idempotent and preserves any existing status line script
(backed up to `*.bak.<ts>` and re-sourced as `statusline-original.sh`).
Then add the printed `statusLine` block to `~/.claude/settings.json` and
restart Claude Code.

> Mode B users do not need this — `setup:external` registers a `statusLine`
> via the plugin's own `hooks.json`, so the segment is rendered through
> `--plugin-dir` automatically.

> When running Claude Code inside the Agent Tracer repository itself,
> `setup:external` is not needed. You can start with
> `claude --plugin-dir packages/runtime` directly.

## Running this repository locally

```bash
npm install
npm run build
npm run infra:up   # start Postgres + Redis (requires Docker)
npm run dev
```

- Dashboard: http://127.0.0.1:5173
- Monitor server: http://127.0.0.1:3847

Stop the infra containers with `npm run infra:down` when you're done.

## NPM release

- Publish: `npm run publish:all` (publishes `@monitor/api-gateway` to npm with
  public access; other workspaces are currently private).
- Manual GitHub Actions run:
  - Select `Run workflow` in `.github/workflows/publish-packages.yml`
  - Set `dryRun` to `true` to run with `--dry-run` (no upload)
- Tag-based release deployment:
  - Push a tag in the format `v*` (e.g., `v0.1.0`) to trigger the publish job.
- Requires `NPM_TOKEN` secret in your repository
  (`Settings > Secrets and variables > Actions`).

## Rule Lane

The dashboard supports a **rule lane** — a distinct timeline lane (orange) for commands you
designate as mandatory checks (e.g. `npm run lint`, `npm run typecheck`).

- Open the shield icon in the top bar to manage rule patterns
- Patterns are matched by **case-insensitive substring** against the executed command string
- Patterns can be **global** (apply to all tasks) or **task-scoped**
- Matching `terminal.command` events are reclassified to the `rule` lane server-side at ingest

## Thought-Flow Observability

The dashboard now displays diagnostic information alongside event timelines:

- Top bar diagnostics cards: prompt capture rate, trace-linked task rate,
  stale running tasks, average task duration
- Inspector `Flow` tab: phase breakdown, active duration, session state,
  top files/tags, work item/goal/plan/handoff focus
- Inspector `Health` tab: trace link coverage, action-registry gaps,
  question/todo closure rates, coordination/background activity, runtime lineage

## Packages

| Package | Path | Role |
|---------|------|------|
| `@monitor/api-gateway` | `packages/server/api-gateway` | NestJS composition root (HTTP + WebSocket) backed by Postgres + Redis. Builds two entrypoints via `tsup`: `dist/index.js` (server) and `dist/mcp.js` (MCP stdio adapter). Composes the `*-api` domain packages below. |
| `@monitor/{identity,run,rules,insight,timeline}-api`, `@monitor/ws-gateway`, `@monitor/shared` | `packages/server/*` | Domain + infrastructure packages consumed by the gateway |
| `@monitor/web` | `packages/web` | React 19 dashboard |
| `@monitor/runtime` | `packages/runtime` | Runtime adapters. Plugin root is `packages/runtime/` (`.claude-plugin/plugin.json`). Hooks live at `hooks/hooks.json` + `bin/run-hook-claude.sh` (Claude) and `bin/run-hook-codex.sh` (Codex, hydrated from `hooks/hooks-codex.json` by `setup:external`). Hook source `.ts` files under `src/claude-code/hooks/` and `src/codex/hooks/`. |
