# Claude Code Plugin Adapter

The canonical Claude Code integration path is `.claude/plugin/`. From a
user's point of view it is a plugin; under the hood each Claude Code hook
event has a dedicated TypeScript file that posts to the monitor server.

## Key files

### Plugin root

- `.claude/plugin/.claude-plugin/plugin.json` — plugin manifest
- `.claude/plugin/hooks/hooks.json` — event to handler registration
- `.claude/plugin/bin/run-hook.sh` — `tsx` dispatcher
- `.claude/settings.json` — repo-local permissions (plugin path is passed via `--plugin-dir`)

### Top-level hook handlers

Each file name mirrors the Claude Code hook event it handles.

- `.claude/plugin/hooks/SessionStart.ts`
- `.claude/plugin/hooks/UserPromptSubmit.ts`
- `.claude/plugin/hooks/PreToolUse.ts`
- `.claude/plugin/hooks/PostToolUseFailure.ts`
- `.claude/plugin/hooks/SubagentStart.ts`
- `.claude/plugin/hooks/SubagentStop.ts`
- `.claude/plugin/hooks/PreCompact.ts`
- `.claude/plugin/hooks/PostCompact.ts`
- `.claude/plugin/hooks/SessionEnd.ts`
- `.claude/plugin/hooks/Stop.ts`

### `PostToolUse/` sub-handlers

`PostToolUse` is split by matcher, so each tool family has its own file:

- `.claude/plugin/hooks/PostToolUse/Bash.ts` — terminal commands → `/api/terminal-command`
- `.claude/plugin/hooks/PostToolUse/File.ts` — `Edit` / `Write` → `/api/tool-used`
- `.claude/plugin/hooks/PostToolUse/Explore.ts` — `Read` / `Glob` / `Grep` / `WebSearch` / `WebFetch` → `/api/explore`
- `.claude/plugin/hooks/PostToolUse/Agent.ts` — `Agent` / `Skill` → `/api/agent-activity`
- `.claude/plugin/hooks/PostToolUse/Todo.ts` — `TaskCreate` / `TaskUpdate` / `TodoWrite` → `/api/todo`
- `.claude/plugin/hooks/PostToolUse/Mcp.ts` — `mcp__.*` → `/api/tool-used`

### Supporting modules

- `classification/command-semantic.ts` — shell commands to subtype classification
- `classification/explore-semantic.ts` — file/web tools to exploration subtypes
- `classification/file-semantic.ts` — file operations to file_ops subtypes
- `lib/transport.ts` — HTTP client (`postJson`, `readStdinJson`, `ensureRuntimeSession`)
- `lib/session-cache.ts` — transient per-process session results
- `lib/session-history.ts` — session lineage append log
- `lib/session-metadata.ts` — persisted session metadata
- `lib/subagent-registry.ts` — background subagent tracking
- `lib/hook-log.ts` — development file logging
- `common.ts` — re-exports the above for hook scripts
- `util/lane.ts`, `util/paths.ts`, `util/runtime-identifier.ts`, `util/utils.ts` — framework-agnostic helpers

## Execution flow

1. `hooks.json` maps every Claude Code event (or `PostToolUse` matcher) to
   `${CLAUDE_PLUGIN_ROOT}/bin/run-hook.sh <EventName>[/SubMatcher]`.
2. `run-hook.sh` sets `NODE_ENV=development` by default and runs
   `tsx` on the matching `.ts` file.
3. `SessionStart.ts`, `UserPromptSubmit.ts`, and `PreToolUse.ts` all call
   `ensureRuntimeSession()` so a runtime session exists before any event
   is recorded.
4. `UserPromptSubmit.ts` records the raw prompt as the canonical
   `user.message` event.
5. `PostToolUse/*.ts` handlers record the per-tool activity with semantic
   metadata built by the `classification/` modules.
6. `SubagentStart.ts` / `SubagentStop.ts` record background async
   lifecycle events and update the subagent registry.
7. `PreCompact.ts` and `PostCompact.ts` record compaction checkpoints to
   the planning lane.
8. `Stop.ts` posts the assistant response to `/api/assistant-response`
   and ends the runtime session with `completeTask: true`.
9. `SessionEnd.ts` closes only the current runtime session, so a
   second-turn session does not double-complete the primary task.

## Points worth knowing

### Canonical runtime source

The plugin always sends `runtimeSource = "claude-plugin"` on every event.
Older code used `claude-hook`; the server still accepts it as an alias
but new events use `claude-plugin`.

### Subagent registry is transient

`${CLAUDE_PROJECT_DIR}/.claude/.subagent-registry.json` stores subagent
coordination state (parent/child IDs, running status). It is plugin-local
state, not product data, and it's safe to delete between sessions.

### Development logs opt in via `NODE_ENV`

`bin/run-hook.sh` exports `NODE_ENV=development` by default. Hook
handlers write to `${CLAUDE_PROJECT_DIR}/.claude/hooks.log` only when
`NODE_ENV=development`. Unset this env var in production scenarios if
you want silent execution.

### Web-tool URLs go into a free-form metadata field

`PostToolUse/Explore.ts` detects `WebSearch` / `WebFetch` calls and
stuffs the query/URL into `metadata.webUrls` on the `/api/explore`
request. This field is not part of the Claude Code hook payload spec —
it is an Agent Tracer extension stored in the event `metadata` column.
The web dashboard surfaces it via the Exploration tab's "Web Lookups"
section.

### Hooks cannot block execution

Claude Code `PostToolUse` hooks cannot block the caller — exit code 2
prints to stderr but execution continues. The plugin intentionally never
returns non-zero on tracking failures; a monitor-server outage produces
a warning in the hook log but does not interrupt the user.

## Related

- [Runtime Adapters & Integration](./runtime-adapters-and-integration.md)
- [HTTP API Reference](./http-api-reference.md)
- [Runtime Capabilities Registry](./runtime-capabilities-registry.md)
- [Setup guide — Claude Code](/guide/claude-setup)
- [Hook payload spec](/guide/hook-payload-spec)
