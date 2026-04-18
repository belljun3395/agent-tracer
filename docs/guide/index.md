# Setup Guides

Practical setup guides for Agent Tracer. If you want to understand how
the code is organised instead of how to install it, go to the
[codebase wiki](/wiki/).

## Quick start (Claude Code plugin)

Agent Tracer is distributed as a Claude Code **plugin** (`.claude/plugin/`).
The plugin automatically registers all hook events and posts them to the
monitor server. You do not need to copy hook source files or perform manual
configuration.

### Minimal setup path

1. **[Install and Run](./install-and-run.md)** — clone the repo, install
   dependencies, start the monitor server and web dashboard, verify the
   installation.
2. **[Claude Code Setup](./claude-setup.md)** — load the plugin and register
   the MCP server. Claude Code integration is complete after these two steps.

### Attach to external projects (optional)

If you want to use Agent Tracer with a project outside this repository, follow
an additional step:

3. **[External Project Setup](./external-setup.md)** — run
   `npm run setup:external` to generate `.claude/settings.json` in your target
   project and confirm the `--plugin-dir` path.

> **Note:** When running Claude Code inside the Agent Tracer repository itself,
> `setup:external` is not needed. You can start with
> `claude --plugin-dir .claude/plugin` directly.

### Other runtimes (manual HTTP/MCP)

Runtimes other than Claude Code do not have automatic adapters. See
[External Project Setup § 5](./external-setup.md#5-attach-other-runtimes-manual)
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
- [Web styling guide](./web-styling.md) — CSS / Tailwind conventions
  used by `@monitor/web-app`

## Related

- [Codebase wiki](/wiki/) — architecture, packages, and maintainer notes
- [Claude Code plugin adapter](/wiki/claude-code-plugin-adapter) —
  internal view of the plugin you installed
- [`setup:external` automation script](/wiki/setup-external-automation-script)
  — what the setup script actually does
