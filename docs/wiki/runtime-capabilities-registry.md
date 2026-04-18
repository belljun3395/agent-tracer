# Runtime Capabilities Registry

The runtime capability registry is a table that encodes in code "what each runtime can observe,
and what lifecycle policy it should have when the session ends".
The actual source of truth is `packages/domain/src/runtime/capabilities.defaults.ts` and
`packages/domain/src/runtime/capabilities.helpers.ts`.

## Core Files

- `packages/domain/src/runtime/capabilities.defaults.ts`
- `packages/domain/src/runtime/capabilities.types.ts`
- `packages/domain/src/runtime/capabilities.helpers.ts`
- `docs/guide/runtime-capabilities.md`

## Currently Registered Adapters

| Adapter | Raw prompt | Tool calls | Subagents | Native skill discovery | Event stream | Session close policy |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-plugin` | Yes | Yes | Yes | `.claude/skills` | No | `never` |

Note:

- The `runtimeSource` in the server HTTP schema is open as a string for extensibility.
- `claude-hook` is an alias for backward compatibility with historical data, and the canonical value for documentation and new events is `claude-plugin`.

## Why Capability is Needed

- Whether raw user prompts can be captured mechanically
- Whether tool / terminal / MCP activity can be observed automatically
- Whether subagent/background lineage can be tracked automatically
- Whether to close a task or leave it in `waiting` state when the session closes

By making this difference explicit in the registry, server lifecycle policy, observability evidence,
and guide documentation can share the same expectations.

## Operational Points

- The capability table should document "what actual code guarantees", not "documentation recommendations".
- When adding a new runtime, update the registry before README to reduce drift.
- Manual HTTP/MCP clients can use the server API as-is even if not registered as a built-in adapter in the registry.

## Related Documentation

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
