# Runtime Adapters & Integration

Agent Tracer is not tied to a single agent runtime, but the only
automated adapter in this repository is the Claude Code plugin. Other
runtimes attach by calling the shared HTTP + MCP surface directly.

## Supported integration paths

| Path | Representative runtime | Notes |
|------|-----------------------|-------|
| Plugin | Claude Code | Plugin internally registers every Claude Code hook event and observes runtime lifecycle + tool activity automatically |
| Manual HTTP / MCP | any custom runtime | Caller explicitly invokes session / task / event endpoints |

## Key files

- `packages/domain/src/runtime/capabilities.types.ts` — capability contract types
- `packages/application/src/runtime/capabilities.constants.ts`
- `packages/application/src/runtime/capabilities.defaults.ts`
- `packages/application/src/runtime/capabilities.helpers.ts`
- `packages/application/src/runtime/index.ts` (barrel)
- `packages/domain/src/interop/event-semantic.ts` — explicit hook/web semantic contract
- `packages/classification/src/classifier.ts` — server-side ingestion classifier
- `packages/classification/src/semantic-metadata.ts` — shared semantic metadata derivation
- `packages/adapter-mcp/src/index.ts`
- `packages/hook-plugin/hooks/*` — hook implementations
- `packages/hook-plugin/hooks/PostToolUse/*` — per-tool sub-handlers
- `packages/hook-plugin/hooks/lib/*` — shared utilities (transport, transcript, logging)
- `packages/hook-plugin/hooks/util/*` — framework-agnostic helpers
- `packages/hook-plugin/hooks/hooks.json`
- `packages/hook-plugin/bin/run-hook.sh`
- `.claude/plugin` — relative symlink to `packages/hook-plugin` so `${CLAUDE_PLUGIN_ROOT}` still resolves
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`

## Hook layer structure

`packages/hook-plugin/hooks/` separates three responsibilities:

```text
packages/hook-plugin/hooks/
├── lib/                      # shared runtime utilities
│   ├── transport.ts              # HTTP client + ensureRuntimeSession
│   ├── session.ts                # resolveSessionIds thin wrapper
│   ├── subagent-session.ts       # virtual session routing for subagents
│   ├── transcript-cursor.ts      # per-session byte-offset persistence
│   ├── transcript-tail.ts        # incremental transcript tailing
│   ├── transcript-emit.ts        # emit tailed messages as events
│   ├── json-file-store.ts        # safe atomic JSON read/write
│   └── hook-log.ts               # development logging
├── util/                     # framework-agnostic helpers
│   ├── lane.ts                   # TimelineLane constants
│   ├── paths.ts                  # project path utilities
│   └── utils.ts                  # JSON payload helpers
├── PostToolUse/              # per-tool sub-handlers (raw payloads)
│   ├── Bash.ts                   # terminal commands
│   ├── File.ts                   # Edit / Write
│   ├── Explore.ts                # Read / Glob / Grep / WebSearch / WebFetch
│   ├── Agent.ts                  # Agent / Skill
│   ├── Todo.ts                   # TaskCreate / TaskUpdate / TodoWrite
│   └── Mcp.ts                    # mcp__.*
├── SessionStart.ts
├── UserPromptSubmit.ts
├── PreToolUse.ts
├── PostToolUseFailure.ts
├── SubagentStart.ts / SubagentStop.ts
├── PreCompact.ts / PostCompact.ts
├── SessionEnd.ts / Stop.ts
├── hooks.json                # event → handler registration
└── (executed via bin/run-hook.sh)
```

Semantic classification (lane / subtype / toolFamily / operation) was
removed from the plugin in v0.2.0; it now happens server-side in
`@monitor/classification` at ingestion. The plugin layer is limited to
transport, transcript bookkeeping, and subagent session routing, which
lets new runtime adapters reuse `lib/` without inheriting Claude-specific
semantic logic.

## Design principles

### Capability first

Raw-prompt access, tool-call observation, subagent tracking, and
"session close means task complete" differ per runtime. The shared
contract in `runtime-capabilities` pins the differences before any
code takes advantage of them.

### Shared server surface

Regardless of how an event enters the server, it must conform to the
same canonical events (`user.message`, `assistant.response`,
`task.start`, etc.). The server layer stays runtime-agnostic.

### Domain as the contract owner

`@monitor/domain` owns the event types, lanes, runtime capability
contracts, and workflow evaluation types; `@monitor/classification`
owns server-side lane/subtype/toolFamily/operation derivation; and
`@monitor/application` owns use cases and ports. The server, MCP, and
web all depend on these inner-ring packages — nothing else should
define the same shapes. `@monitor/core` remains as a transitional
facade that re-exports from the first three.

## Points worth knowing

### Claude uses the plugin path

The only auto-instrumented Claude integration in this repo is
`packages/hook-plugin/` (surfaced as `.claude/plugin` via a relative
symlink so `${CLAUDE_PLUGIN_ROOT}` still resolves). The canonical
`runtimeSource` value is `claude-plugin` (with `claude-hook` preserved
as a legacy alias).

### `setup:external` only automates Claude today

`scripts/setup-external.mjs` writes `.claude/settings.json` for the
target project and prints the plugin launch command. It does not
generate bootstrap files for other runtimes.

### Manual runtimes drive the API explicitly

Runtimes without an auto-plugin use `@monitor/adapter-mcp` tools or call the
HTTP endpoints directly. Capability then becomes a caller contract —
the server has no way to infer it.

## Maintenance notes

### Contracts leak when consumers re-declare types

Domain is the source of truth, but every consumer that re-declares an
event type is a drift risk. Web packages now re-export from
`@monitor/domain` (via the `web-domain` layer), which helps, but search
hit shapes and UI view models still diverge.

### Phase semantics aren't fully enforced

Events like `question.logged` and `user.message` carry richer semantics
in the docs and MCP input than the core classifier enforces. A future
iteration should make the canonical event contract a discriminated
union and validate it at the server boundary.

### MCP registration grows linearly

`packages/adapter-mcp/src/index.ts` works today but registering tools is
essentially a manual list. Moving to a descriptor-based registration
would cut drift as more tools are added.

### Runtime lineage across platforms

`slug` handling collapses non-ASCII titles to empty strings, and path
normalization only partially handles Windows paths. Neither is a
production issue today; both should be addressed as soon as a non-POSIX
runtime is attached.

### Route / schema / MCP triple edit

Adding an event today typically requires changes in: `@monitor/domain`
(wire schema), `@monitor/classification` (lane/subtype derivation),
`@monitor/application` (use case + types), a server controller,
`packages/adapter-mcp/src/*`, and the guide docs. A published "new event
checklist" would reduce orphan edits.

## Checklist for adding a new runtime

1. Can raw user prompts be captured mechanically?
2. Can tool calls be observed per type?
3. Can background / subagent activity be tracked?
4. Does session close mean `waiting` or `completed`?
5. What is the minimum HTTP endpoint set this runtime needs?

`docs/guide/api-integration-map.md` and
`docs/guide/runtime-capabilities.md` are the right starting points for
that decision.

## Related

- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
- [setup:external Automation Script](./setup-external-automation-script.md)
- [API integration map](/guide/api-integration-map)
