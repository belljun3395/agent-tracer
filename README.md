# Agent Tracer

A Claude Code-centric local monitor server and dashboard.
This repository implements a Claude Code plugin-based event collection path.
The server and MCP layers are also open to manual HTTP/MCP clients.

## Quick Start (Claude Code plugin)

Agent Tracer is distributed as a Claude Code **plugin** (`packages/runtime/`).
The plugin automatically registers all hook events and posts them to the monitor
server. You do not need to copy hook source files to your target project.

```bash
npm install
npm run build
npm run dev
```

### Minimal setup path

1. **[Install and Run](docs/guide/install-and-run.md)** — clone the repo,
   install dependencies, start the monitor server and web dashboard, verify
   the installation.
2. **[Claude Code Setup](docs/guide/claude-setup.md)** — load the plugin and
   register the MCP server. Claude Code integration is complete after these
   two steps.

### Attach to external projects (optional)

If you want to use Agent Tracer with a project outside this repository, follow
an additional step:

3. **[External Project Setup](docs/guide/external-setup.md)** — run
   `npm run setup:external` to generate `.claude/settings.json` in your target
   project.

### Global status line (optional, recommended)

Claude Code plugins can register hook events but **cannot** register a
`statusLine` (it is a `settings.json`-only field). To get the
`[monitor] ctx N% · 5h N% · $X` segment in *every* project, install the
wrapper once globally:

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

> When running Claude Code inside the Agent Tracer repository itself,
> `setup:external` is not needed. You can start with
> `claude --plugin-dir packages/runtime/src/claude-code` directly.

Latest guide: https://belljun3395.github.io/agent-tracer/guide/

## Running this repository locally

```bash
npm install
npm run build
npm run dev
```

- Dashboard: http://127.0.0.1:5173
- Monitor server: http://127.0.0.1:3847

## Guide map

| Purpose | Document |
|---------|----------|
| Local installation and running | [docs/guide/install-and-run.md](docs/guide/install-and-run.md) |
| Claude Code plugin setup | [docs/guide/claude-setup.md](docs/guide/claude-setup.md) |
| External project setup (optional) | [docs/guide/external-setup.md](docs/guide/external-setup.md) |
| Runtime capabilities reference | [docs/guide/runtime-capabilities.md](docs/guide/runtime-capabilities.md) |

## Documentation site

To view Markdown under `docs/` as a paginated documentation site, use the
VitePress entrypoint:

```bash
npm run docs:dev
```

- Default URL: `http://127.0.0.1:5174`
- Home: `docs/index.md`
- Guide section: `docs/guide/*`

### GitHub Pages deployment

- Workflow: `.github/workflows/deploy-docs.yml`
- First-time setup: select `GitHub Actions` in your repository settings
  under `Settings > Pages > Build and deployment > Source`.
- After setup, any documentation changes pushed to `main` are automatically
  deployed to GitHub Pages.
- Current deployment URL: `https://belljun3395.github.io/agent-tracer/`

### NPM release

- Publish: `npm run publish:all` (publishes `@monitor/server` to npm with
  public access; other workspaces are currently private).
- Manual GitHub Actions run:
  - Select `Run workflow` in `.github/workflows/publish-packages.yml`
  - Set `dryRun` to `true` to run with `--dry-run` (no upload)
- Tag-based release deployment:
  - Push a tag in the format `v*` (e.g., `v0.1.0`) to trigger the publish job.
- Requires `NPM_TOKEN` secret in your repository
  (`Settings > Secrets and variables > Actions`).

## Thought-Flow Observability

The dashboard now displays diagnostic information alongside event timelines:

- Top bar diagnostics cards: prompt capture rate, trace-linked task rate,
  stale running tasks, average task duration
- Inspector `Flow` tab: phase breakdown, active duration, session state,
  top files/tags, work item/goal/plan/handoff focus
- Inspector `Health` tab: trace link coverage, action-registry gaps,
  question/todo closure rates, coordination/background activity, runtime lineage

See `docs/guide/task-observability.md` for detailed contracts and API specs.

## Packages

| Package | Path | Role |
|---------|------|------|
| `@monitor/server` | `packages/server` | NestJS monitor server (HTTP + WebSocket + SQLite) with an MCP stdio adapter exposed through the `./mcp` subpath export |
| `@monitor/web` | `packages/web` | React 19 dashboard |
| `@monitor/runtime` | `packages/runtime` | Runtime adapters. Ships the Claude Code plugin at `packages/runtime/src/claude-code` (also mounted at `packages/runtime/` for marketplace installs) |
