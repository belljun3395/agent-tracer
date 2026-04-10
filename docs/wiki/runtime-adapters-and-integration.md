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

- `packages/core/src/runtime-capabilities.ts` (barrel)
- `packages/core/src/runtime-capabilities.constants.ts`
- `packages/core/src/runtime-capabilities.types.ts`
- `packages/core/src/runtime-capabilities.defaults.ts`
- `packages/core/src/runtime-capabilities.helpers.ts`
- `packages/core/src/event-semantic.ts` — explicit hook/web semantic contract
- `packages/core/src/classifier.ts`
- `packages/mcp/src/index.ts`
- `.claude/plugin/hooks/*` — hook implementations
- `.claude/plugin/hooks/PostToolUse/*` — per-tool sub-handlers
- `.claude/plugin/hooks/classification/*` — semantic inference engines
- `.claude/plugin/hooks/lib/*` — shared utilities (transport, caching, logging)
- `.claude/plugin/hooks/common.ts` — re-exports for hook scripts
- `.claude/plugin/hooks/hooks.json`
- `.claude/plugin/bin/run-hook.sh`
- `docs/guide/runtime-capabilities.md`
- `docs/guide/api-integration-map.md`

## Hook layer structure

`.claude/plugin/hooks/` separates five responsibilities:

```text
.claude/plugin/hooks/
├── classification/           # pure semantic inference
│   ├── command-semantic.ts       # shell commands → subtype classification
│   ├── explore-semantic.ts       # file/web tools → exploration subtypes
│   └── file-semantic.ts          # file operations → file_ops subtypes
├── lib/                      # shared utilities
│   ├── transport.ts              # HTTP client
│   ├── session-cache.ts          # per-process session cache
│   ├── session-history.ts        # session lineage log
│   ├── session-metadata.ts       # persisted session metadata
│   ├── subagent-registry.ts      # background subagent tracking
│   └── hook-log.ts               # development logging
├── util/                     # framework-agnostic helpers
│   ├── lane.ts                   # TimelineLane constants
│   ├── paths.ts                  # project path utilities
│   ├── runtime-identifier.ts     # resume ID generation
│   └── utils.ts                  # JSON payload helpers
├── PostToolUse/              # per-tool sub-handlers
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
├── common.ts                 # re-exports used by hook scripts
├── hooks.json                # event → handler registration
└── (executed via bin/run-hook.sh)
```

This split lets new runtime adapters reuse `lib/` transport and cache
code without inheriting Claude-specific semantic logic, while
`classification/` stays independently testable as pure functions.

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

### Core as the contract owner

`@monitor/core` owns the event types, lanes, classification results,
runtime capabilities, and workflow evaluation types. The server, MCP,
and web all import from core — nothing else should define the same
shapes.

## Points worth knowing

### Claude uses the plugin path

The only auto-instrumented Claude integration in this repo is
`.claude/plugin/`. The canonical `runtimeSource` value is
`claude-plugin` (with `claude-hook` preserved as a legacy alias).

### `setup:external` only automates Claude today

`scripts/setup-external.mjs` writes `.claude/settings.json` for the
target project and prints the plugin launch command. It does not
generate bootstrap files for other runtimes.

### Manual runtimes drive the API explicitly

Runtimes without an auto-plugin use `@monitor/mcp` tools or call the
HTTP endpoints directly. Capability then becomes a caller contract —
the server has no way to infer it.

## Maintenance notes

### Contracts leak when consumers re-declare types

Core is the source of truth, but every consumer that re-declares an
event type is a drift risk. `packages/web/src/types.ts` now re-exports
from core, which helps, but search hit shapes and UI view models still
diverge.

### Phase semantics aren't fully enforced

Events like `question.logged` and `user.message` carry richer semantics
in the docs and MCP input than the core classifier enforces. A future
iteration should make the canonical event contract a discriminated
union and validate it at the server boundary.

### MCP registration grows linearly

`packages/mcp/src/index.ts` works today but registering tools is
essentially a manual list. Moving to a descriptor-based registration
would cut drift as more tools are added.

### Runtime lineage across platforms

`slug` handling collapses non-ASCII titles to empty strings, and path
normalization only partially handles Windows paths. Neither is a
production issue today; both should be addressed as soon as a non-POSIX
runtime is attached.

### Route / schema / MCP triple edit

Adding an event today typically requires changes in: `@monitor/core`,
`application/types.ts`, `presentation/schemas.ts`, a server controller,
`packages/mcp/src/*`, and the guide docs. A published "new event
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
