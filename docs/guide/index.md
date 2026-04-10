# Setup Guides

Practical setup guides for Agent Tracer. If you want to understand how
the code is organised instead of how to install it, go to the
[codebase wiki](/wiki/).

## Linear install path

Follow these pages in order the first time.

1. **[Install and Run](./install-and-run.md)** — clone the repo, install
   dependencies, start the monitor server and web dashboard, verify the
   install.
2. **[External Project Setup](./external-setup.md)** — attach Agent
   Tracer to a target project with `npm run setup:external`.
3. **[Claude Code Setup](./claude-setup.md)** — the Claude-specific
   plugin + MCP steps, including what each hook does.

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
  used by `@monitor/web`

## Related

- [Codebase wiki](/wiki/) — architecture, packages, and maintainer notes
- [Claude Code plugin adapter](/wiki/claude-code-plugin-adapter) —
  internal view of the plugin you installed in step 3
- [`setup:external` automation script](/wiki/setup-external-automation-script)
  — what the setup script actually does
