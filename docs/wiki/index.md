# Agent Tracer Wiki

This section is a codebase wiki maintained in the local repository with a structure matching DeepWiki.
Rather than an installation guide, it focuses on understanding how current code is divided in responsibility
and how it connects.

## Reading Order

1. [Agent Tracer overview](./agent-tracer-overview.md)
2. [Getting started & installation](./getting-started-and-installation.md)
3. [Architecture & package map](./architecture-and-package-map.md)
4. [Core domain & event model](./core-domain-and-event-model.md)
5. [Monitor server](./monitor-server.md)
6. [Web dashboard](./web-dashboard.md)
7. [Workflow library & evaluation](./workflow-library-and-evaluation.md)

## Key Sections

### Domain, application, and server

- [Core domain & event model](./core-domain-and-event-model.md)
- [Domain model: tasks, sessions & timeline events](./domain-model-tasks-sessions-and-timeline-events.md)
- [Monitor server](./monitor-server.md)
- [HTTP API reference](./http-api-reference.md)
- [SQLite infrastructure & schema](./sqlite-infrastructure-and-schema.md)

### Runtime and MCP

- [Runtime adapters & integration](./runtime-adapters-and-integration.md)
- [Claude Code plugin adapter](./claude-code-plugin-adapter.md)
- [MCP server](./mcp-server.md)
- [MCP tool reference](./mcp-tool-reference.md)

### Web and Workflows

- [Web dashboard](./web-dashboard.md)
- [Timeline canvas](./timeline-canvas.md)
- [Event inspector & insights engine](./event-inspector-and-insights-engine.md)
- [Workflow library & evaluation](./workflow-library-and-evaluation.md)
- [Saving & rating workflows](./saving-and-rating-workflows.md)
- [Searching similar workflows](./searching-similar-workflows.md)

### Quality and Testing

- [Testing & development](./testing-and-development.md)
- [Server-side tests](./server-side-tests.md)
- [Web & core tests](./web-and-core-tests.md)
- [Glossary](./glossary.md)

## Maintainer Notes

- [Quality and testing](./quality-and-testing.md)
