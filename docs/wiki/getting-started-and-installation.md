# Getting Started & Installation

This document is a starting point that brings together "how to start Agent Tracer now and where to begin reading code".
The actual installation procedures per runtime are more detailed in `docs/guide`, and
this page organizes the minimum path needed from a repository perspective.

## Local Development Mode

The most common development loop is running server and web simultaneously.

```bash
npm install
npm run build
npm run dev
```

- Server: `http://127.0.0.1:3847`
- Web: `http://127.0.0.1:5173`
- `npm run dev` executes `dev:server` and `dev:web` simultaneously.
- `npm run dev:server` starts the NestJS-based runtime via `packages/server/src/index.ts`.

To view server only:

```bash
npm run dev:server
```

To check MCP server separately, build first then use:

```bash
npm run start:mcp
```

## Attaching to External Projects

The primary goal of this repository is to connect and use Agent Tracer with other projects.
The recommended approach is not to copy code, but to maintain this repository as the monitor server
and source repository while creating only minimal configuration files in external projects.

Key entry points:

- [Install and Run](/guide/install-and-run)
- [External Project Setup](/guide/external-setup)
- [Claude Code Setup](/guide/claude-setup)

Automated installation script:

```bash
npm run setup:external -- --target /path/to/project
```

What the above script currently actually automates is only Claude settings cleanup in external projects
and plugin execution path guidance.

## Good Endpoints to Verify Locally

- `GET /health` - server health check
- `GET /api/overview` - dashboard summary status
- `GET /api/tasks` - current task list
- `GET /api/workflows` - saved evaluations list

Simple smoke test:

```bash
curl -sf http://127.0.0.1:3847/api/overview
```

## Starting Points for Reading Code

When structure is more interesting than installation, this order is fastest:

1. `README.md`
2. `packages/server/src/index.ts`
3. `packages/core/src/domain/index.ts` (barrel, internally `packages/core/src/domain/*`)
4. `packages/mcp/src/index.ts`
5. `packages/web/src/App.tsx`

## Separation of Roles Between Installation and Wiki

- Configuration procedures and per-runtime operational rules are in `docs/guide/*`
- Code structure and responsibility decomposition are in `docs/wiki/*`

In other words, for "how to make something work", check the guide first, and for "why is this structured this way",
read the wiki.

## Related Documentation

- [setup:external Automation Script](./setup-external-automation-script.md)
- [Architecture & Package Map](./architecture-and-package-map.md)
- [Testing & Development](./testing-and-development.md)
