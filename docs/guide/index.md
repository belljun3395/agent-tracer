# Setup Guides

Practical setup guides for Agent Tracer. If you want to understand how
the runtime and API contracts instead of how to install it, use the
reference pages below.

## Quick start

Agent Tracer currently has two guided setup paths:

- Claude Code plugin setup
- Codex bootstrap via repo-local hooks plus repo-local config

### Minimal setup path

1. **[Install and Run](./install-and-run.md)** — clone the repo, install
   dependencies, start the monitor server and web dashboard, verify the
   installation.
2. **[Claude Code Setup](./claude-setup.md)** — load the plugin and register
   the MCP server. Claude Code integration is complete after these two steps.
3. **[Codex Setup](./codex-setup.md)** — use plain `codex` with the generated
   repo-local hooks and config.

### Attach to external projects (optional)

If you want to use Agent Tracer with a project outside this repository, follow
an additional step:

4. **[External Project Setup](./external-setup.md)** — run
   `npm run setup:external` to generate `.claude/settings.json`, `.codex/config.toml`,
   and `.codex/hooks.json` in your target project.

> **Note:** When running Claude Code inside the Agent Tracer repository itself,
> `setup:external` is not needed. You can start with
> `claude --plugin-dir packages/runtime/src/claude-code` directly.

### Other runtimes (manual HTTP/MCP)

Runtimes other than Claude Code and Codex do not have automatic adapters. See
[External Project Setup § 6](./external-setup.md#6-attach-other-runtimes-manual)
for the minimal implementation order to call the HTTP API directly.

## Reference

Once you're set up, these pages describe the event surface and runtime
model in more detail.

- [Runtime capabilities](./runtime-capabilities.md) — how the capability
  registry tracks per-runtime differences
- [API integration map](./api-integration-map.md) — every HTTP endpoint
  mapped to hooks and manual-runtime use
- [Runtime API flow & preprocessing](./runtime-api-flow-and-preprocessing.md)
  — preprocessing applied inside each endpoint
- [Claude Code hook payload spec](./hook-payload-spec.md) — exact JSON
  shape of each hook payload consumed by the plugin
- [Task observability](./task-observability.md) — `Flow` and `Health`
  read model used by the dashboard
- [SQLite schema](./sqlite-schema.md) — 정리된 SQLite table 구조,
  event log, current/view table, migration 규칙
- [Web styling guide](./web-styling.md) — CSS / Tailwind conventions
  used by `@monitor/web`

## Related

- [Runtime capabilities](./runtime-capabilities.md) — runtime-specific behavior and evidence guarantees
- [API integration map](./api-integration-map.md) — HTTP and runtime endpoint coverage
- [Task observability](./task-observability.md) — diagnostics surfaced in the dashboard
