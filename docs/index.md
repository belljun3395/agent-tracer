---
layout: home
title: Agent Tracer Docs

hero:
  name: Agent Tracer
  text: Docs, Guides, and Codebase Wiki
  tagline: DeepWiki-style markdown documentation for the runtime adapters, server, dashboard, and workflow library that live in this repository.
  actions:
    - theme: brand
      text: Browse the Wiki
      link: /wiki/
    - theme: alt
      text: Open Setup Guides
      link: /guide/
    - theme: alt
      text: View Repository
      link: https://github.com/belljun3395/agent-tracer

features:
  - title: Codebase Wiki
    details: Maintainer-oriented architecture docs for the core domain, monitor server, MCP surface, runtime adapters, web dashboard, and workflow library.
  - title: Runtime Guides
    details: Practical setup guides for the shipped Claude Code plugin flow, plus manual HTTP/MCP integration references for custom runtimes.
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
- Codebase wiki: `/wiki/`

## Best Entry Points

- [Install and Run](/guide/install-and-run) — local clone → running server
- [External Project Setup](/guide/external-setup) — attach Agent Tracer to a target project
- [Claude Code Setup](/guide/claude-setup) — Claude Code plugin + MCP wiring
- [Agent Tracer wiki](/wiki/) — architecture and maintainer notes
- [Architecture & package map](/wiki/architecture-and-package-map)
- [Workflow library & evaluation](/wiki/workflow-library-and-evaluation)
