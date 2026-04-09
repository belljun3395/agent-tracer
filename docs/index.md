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

```bash
npm run docs:dev
```

- Site root: `/`
- Runtime setup guides: `/guide/`
- DeepWiki-aligned codebase wiki: `/wiki/`

## Best Entry Points

- [Runtime setup map](/guide/)
- [Agent Tracer wiki](/wiki/)
- [Architecture & package map](/wiki/architecture-and-package-map)
- [Workflow library & evaluation](/wiki/workflow-library-and-evaluation)
