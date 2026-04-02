# PR Flow Test

This file exists to verify the pull-request creation and review workflow for agent-tracer.

## Purpose

- Confirm branch → commit → PR pipeline is functional.
- Act as a lightweight anchor commit before broader review-driven fixes land.

## Context

A structured review of the web-to-CLI implementation (`packages/server/src/application/cli-bridge/`,
`packages/server/src/presentation/ws/cli-ws-handler.ts`, `packages/web/src/hooks/useCliChat.ts`)
identified several issues to address:

| Priority | Area | Finding |
|----------|------|---------|
| HIGH | Security | `workdir` path traversal — no server-side validation |
| HIGH | Process lifecycle | SIGKILL timer not cleared on graceful exit |
| MEDIUM | Process lifecycle | `cancel`/`complete` race condition |
| MEDIUM | Frontend | `isCancelling` flag can permanently lock UI on WS error |
| MEDIUM | Validation | Missing field guards on incoming WS messages |

Fixes for the above are landing in the same PR, after this anchor commit.
