# Runtime Adapters & Integration

Agent Tracer is runtime-agnostic at the server boundary, but this
repository currently ships one automated runtime adapter: the Claude Code
plugin. Everything else integrates through the shared HTTP or MCP
surface.

## Supported integration paths

| Path | Representative runtime | Notes |
| --- | --- | --- |
| Claude plugin | Claude Code | Hook package auto-captures runtime lifecycle, tool usage, transcript tails, and subagent lineage |
| Manual HTTP | custom runtimes or scripts | Caller posts canonical events and lifecycle requests directly |
| MCP | agents that prefer stdio tools | `@monitor/adapter-mcp` forwards MCP calls to the HTTP API |

## Key files

- `packages/domain/src/runtime/capabilities.*.ts`
- `packages/domain/src/interop/event-semantic.ts`
- `packages/classification/src/classifier.ts`
- `packages/classification/src/semantic-metadata.ts`
- `packages/adapter-mcp/src/index.ts`
- `packages/adapter-mcp/src/tools/*`
- `packages/hook-plugin/hooks/*`
- `packages/hook-plugin/hooks/PostToolUse/*`
- `packages/hook-plugin/hooks/lib/*`
- `packages/hook-plugin/hooks/util/*`
- `packages/hook-plugin/hooks/hooks.json`
- `packages/hook-plugin/bin/run-hook.sh`
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`

## Hook layer structure

`packages/hook-plugin/hooks/` separates transport, payload parsing, and
per-event logic:

```text
packages/hook-plugin/hooks/
├── lib/
│   ├── transport.ts
│   ├── session.ts
│   ├── subagent-session.ts
│   ├── transcript-cursor.ts
│   ├── transcript-tail.ts
│   ├── transcript-emit.ts
│   ├── json-file-store.ts
│   └── hook-log.ts
├── util/
│   ├── lane.ts
│   ├── paths.ts
│   └── utils.ts
├── PostToolUse/
│   ├── Bash.ts
│   ├── File.ts
│   ├── Explore.ts
│   ├── Agent.ts
│   ├── Todo.ts
│   └── Mcp.ts
├── SessionStart.ts
├── UserPromptSubmit.ts
├── PreToolUse.ts
├── PostToolUseFailure.ts
├── SubagentStart.ts
├── SubagentStop.ts
├── PreCompact.ts
├── PostCompact.ts
├── SessionEnd.ts
├── Stop.ts
└── hooks.json
```

## Design principles

### Capability first

Prompt capture, tool visibility, subagent tracking, and turn/session
closure differ by runtime. The capability registry in `@monitor/domain`
defines those differences before the rest of the system consumes them.

### Shared server surface

No matter where an event comes from, it lands on the same canonical
event model. The server should not need runtime-specific branches for
basic ingestion semantics.

### Classification belongs on the server

The plugin now ships raw payloads and session bookkeeping. Semantic
classification is handled in `@monitor/classification` during ingestion,
which keeps runtime adapters thinner and more reusable.

## Points worth knowing

### Claude integration path

The automated Claude integration lives in `packages/hook-plugin/` and is
surfaced locally as `.claude/plugin` through a symlink. The canonical
runtime source is `claude-plugin`.

### `setup:external` only automates Claude

`npm run setup:external` writes a `.claude/settings.json` into another
project and points it at this repo's plugin. It does not scaffold other
runtime adapters.

### Manual clients are responsible for richer semantics

Without the plugin, callers must explicitly post lifecycle and event
data. The server can classify raw events, but it cannot infer prompt or
subagent details the client never sent.

## Maintenance notes

### The plugin is intentionally not an inner-ring package

`@monitor/claude-plugin` does not import `@monitor/application` or
`@monitor/classification`. That guard matters because the plugin is a
transport adapter, not a second backend.

### Transcript tailing is part of the integration contract

Some Claude details are only available in the transcript JSONL, not in
the hook payload. `Stop.ts` and `SubagentStop.ts` therefore tail the
transcript after posting the main assistant response.

### Runtime lineage matters across turn boundaries

`runtime-session-end` may close a runtime session while the task stays
alive. The next `runtime-session-ensure` must create or bind a new
session without losing task continuity.

## Checklist for adding a new runtime

1. Can you capture raw user prompts mechanically?
2. Can you observe tool invocations with enough detail for
   classification?
3. Can you track background/subagent activity?
4. What does "turn end" mean for session and task status?
5. Which minimum HTTP endpoints does the runtime need?

## Related

- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
- [API integration map](/guide/api-integration-map)
