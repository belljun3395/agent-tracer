# Install and Run

This page walks you from "fresh clone" to "dashboard open and monitor
server responding". After you finish this page, head to
[external-setup.md](./external-setup.md) to attach Agent Tracer to a
target project.

## 1. Prerequisites

- **Node.js 20+** — the workspaces use ES modules and `tsx` for local dev
- **npm 10+** (ships with Node 20)
- **git** — to clone the repository
- **Python 3** — only needed if you want to pretty-print JSON responses
  with the `python3 -m json.tool` examples below

## 2. Clone and install

```bash
git clone https://github.com/belljun3395/agent-tracer.git
cd agent-tracer
npm install
```

The repo is an npm workspaces monorepo. `npm install` hydrates every
workspace under `packages/*`, including the Claude Code plugin at
`packages/runtime/src/claude-code`.

## 3. Build every package

```bash
npm run build
```

This runs `npm run build` in each workspace that defines one. A clean
build is required before the first `npm run start:server` or before
publishing. You can skip it if you only use the `dev` scripts below.

## 4. Run the monitor server and dashboard

The easiest way to run everything locally is:

```bash
npm run dev
```

`dev` uses `concurrently` to run the server (`dev:server`) and the web
dashboard (`dev:web`) side by side.

| Service | URL |
|---------|-----|
| Monitor server | `http://127.0.0.1:3847` |
| Web dashboard | `http://127.0.0.1:5173` |

If you only want the server:

```bash
npm run dev:server
```

If you only want the dashboard (assumes the server is already running):

```bash
npm run dev:web
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `MONITOR_PORT` | `3847` | HTTP + WebSocket port of the monitor server |
| `MONITOR_BASE_URL` | unset | Full URL used by the plugin and MCP client when calling the server |
| `NODE_ENV` | `development` in the plugin, unset elsewhere | Enables hook debug log file (see [claude-setup.md](./claude-setup.md)) |

`MONITOR_BASE_URL` takes precedence over `MONITOR_PORT`. Set it when the
server lives on another machine or behind a proxy.

## 5. Verify the monitor server

```bash
curl -sf http://127.0.0.1:3847/health
curl -sf http://127.0.0.1:3847/api/v1/overview | python3 -m json.tool
```

- `GET /health` — server liveness
- `GET /api/v1/overview` — dashboard summary stats
- `GET /api/v1/tasks` — list of known tasks
- `GET /api/v1/rules` — verification rules

Open `http://127.0.0.1:5173` in your browser. You should see the empty
dashboard.

## 6. (Optional) Run the MCP server directly

The MCP server is normally launched by an agent runtime (for example,
Claude Code via `claude mcp add monitor`). If you want to exercise it
manually after a build:

```bash
npm run start:mcp --workspace @monitor/server
```

(`start:mcp` is defined in `packages/server/package.json` and runs
`node ./dist/mcp.js`.) It listens on stdio and forwards tool calls to the
monitor server over HTTP.

## 7. Troubleshooting

| Symptom | Check |
|---------|-------|
| `EADDRINUSE` on 3847 | Another `agent-tracer` instance is running, or set `MONITOR_PORT=<other>` |
| `curl /api/v1/overview` returns HTML | You're hitting the web dev server on 5173 instead of the monitor on 3847 |
| Dashboard stays blank | Check the browser console for WebSocket errors; verify `ws://127.0.0.1:3847/ws` opens |
| `npm run build` fails after a package change | Try `rm -rf packages/*/dist && npm install && npm run build` |

## 8. Next steps

- Attach Agent Tracer to an external project: [external-setup.md](./external-setup.md)
- Claude Code specific flow: [claude-setup.md](./claude-setup.md)
- Codex specific flow: [codex-setup.md](./codex-setup.md)
- HTTP + event surface overview: [api-integration-map.md](./api-integration-map.md)
