---
layout: home
title: Agent Tracer Docs

hero:
  name: Agent Tracer
  text: Setup Guides and Reference Notes
  tagline: Local markdown documentation for installing, wiring, and operating Agent Tracer without relying on a separate wiki layer.
  actions:
    - theme: brand
      text: Open Setup Guides
      link: /guide/
    - theme: alt
      text: Read Task Observability
      link: /guide/task-observability
    - theme: alt
      text: View Repository
      link: https://github.com/belljun3395/agent-tracer

features:
  - title: Runtime Guides
    details: Practical setup guides for the shipped Claude Code plugin flow, plus manual HTTP/MCP integration references for custom runtimes.
  - title: Reference Notes
    details: Focused pages for runtime capabilities, hook payloads, API wiring, and observability contracts that tend to stay stable enough to maintain.
  - title: Local-First Docs
    details: The site is generated directly from the markdown already living in docs/, so local edits and the published docs stay aligned.
---

## Quick Start

Install and run Agent Tracer locally:

```bash
git clone https://github.com/belljun3395/agent-tracer.git
cd agent-tracer
npm install
npm run build
npm run dev
```

- Monitor server: `http://127.0.0.1:3847`
- Web dashboard: `http://127.0.0.1:5173`

To preview this documentation site locally instead:

```bash
npm run docs:dev
```

- Site root: `/`
- Setup guides: `/guide/`

## Best Entry Points

- [Install and Run](/guide/install-and-run) — local clone → running server
- [External Project Setup](/guide/external-setup) — attach Agent Tracer to a target project
- [Claude Code Setup](/guide/claude-setup) — Claude Code plugin + MCP wiring
- [Task Observability](/guide/task-observability) — timeline diagnostics and read-model contracts
- [Runtime capabilities](/guide/runtime-capabilities) — per-runtime behavior differences
- [API integration map](/guide/api-integration-map) — endpoint and hook wiring
