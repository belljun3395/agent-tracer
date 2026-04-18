# setup:external Automation Script

`npm run setup:external` is a script that automatically organizes configuration files needed when
attaching Agent Tracer to other projects.
Current implementation focuses on refining Claude settings in external projects and guiding plugin execution paths.

## Core Files

- `scripts/setup-external.mjs`
- `docs/guide/external-setup.md`
- `docs/guide/claude-setup.md`

## Current Support Scope

- Required input: `--target`
- Current automation target: Claude Code
- Other runtimes provided with manual HTTP/MCP reference only

## What the Current Script Does

- Creates or merges `.claude/settings.json`
- Removes existing `hooks` block if present
- Outputs absolute path to the plugin directory in the current repository.
  The canonical source is `packages/hook-plugin/`; `.claude/plugin` is a
  relative symlink to it, so either path resolves to the same tree.
- Guides execution command `claude --plugin-dir <path>`

## Important Changes Based on Recent Code

### No Longer Vendors Files

Unlike previous documentation, the current script does not copy hook/plugin sources to external projects.
Instead, it directly references the running local repository's `packages/hook-plugin/` (via the
`.claude/plugin` symlink).

### Source-Related Arguments Still Exist But Are Not Used for Core Behavior

`--source-repo`, `--source-ref`, and `--source-root` parsing remain in the code, but
are not used for selecting vendoring sources in the current implementation that directly references the Claude plugin path.

## Related Documentation

- [Getting Started & Installation](./getting-started-and-installation.md)
- [Claude Code Plugin Adapter](./claude-code-plugin-adapter.md)
