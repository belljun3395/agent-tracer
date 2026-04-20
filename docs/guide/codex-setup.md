# Codex Setup

This page covers the Codex-specific steps after the shared
[install-and-run](./install-and-run.md) flow.

Unlike Claude Code, Codex does not currently have a plugin packaging surface
that Agent Tracer can publish into. The current Codex integration uses:

- repo-local Codex hooks for interactive sessions
- a repo-local `.codex/config.toml` that enables Codex hooks by default

## 1. Bootstrap the target project

Run [external-setup.md](./external-setup.md) first:

```bash
npm run setup:external -- --target /absolute/path/to/your-project
```

For Codex, the setup script creates:

- `target/.codex/config.toml`
- `target/.codex/hooks.json`

These files reference the Agent Tracer checkout directly with absolute paths.
After setup, the intended usage is simply:

```bash
cd /absolute/path/to/your-project
codex
```

## 2. Prerequisites

- The monitor server is running (`npm run dev` or `npm run dev:server`)
- `curl -sf http://127.0.0.1:3847/api/overview` returns 200
- Codex CLI is installed and working

## 3. Interactive Codex with hooks

Use plain Codex from the target project root:

```bash
cd /absolute/path/to/your-project
codex
```

`setup:external` writes `.codex/config.toml` with `codex_hooks = true`, and
the generated `.codex/hooks.json` embeds `MONITOR_BASE_URL` directly in each
hook command. No extra wrapper is required for the normal interactive path.

### What this captures today

Interactive Codex currently captures:

- `SessionStart` -> `context.saved`
- `UserPromptSubmit` -> `user.message`
- `PostToolUse` (`Bash` only) -> `terminal.command`
- `Stop` -> `assistant.response`

`PreToolUse` is also wired, but it only ensures the runtime session exists
before the Bash command is logged.

## 4. 현재 capture 범위

현재 Codex integration은 interactive hooks 중심이다.

수집 가능한 기본 이벤트:

- `context.saved`
- `user.message`
- `terminal.command` (`Bash` only)
- `assistant.response`

즉, 이번 단계는 “Codex를 평소처럼 `codex`로 실행하는 사용자”의 기본 활동을
캡처하는 데 초점을 둔다.

### Smoke test

다음 순서로 확인한다.

1. 대상 프로젝트에서 `codex` 실행
2. 짧은 프롬프트 하나 제출
3. Bash 명령이 한 번 실행되도록 유도
4. 대시보드에서 아래 이벤트 확인
   - `context.saved`
   - `user.message`
   - `terminal.command`
   - `assistant.response`

## 5. Context / model observer

Codex does not currently expose a Claude-style `statusLine` hook. The closest
equivalent is the app-server surface.

Agent Tracer now includes a small observer that:

- reads the latest Codex session hint written by hooks
- starts `codex app-server`
- resumes that thread
- emits `context.snapshot` events from app-server status telemetry
- prints a compact status string such as `[monitor] ctx 30% · 15m 25%`

This observer is now started automatically by the Codex `SessionStart` hook.
In the normal path you do **not** need to launch a second command manually.

If you want to debug or run it by hand, use:

```bash
cd /absolute/path/to/agent-tracer
npm run codex:observe -- --latest-in /absolute/path/to/your-project
```

You can also target a specific thread directly:

```bash
npm run codex:observe -- --thread-id <codex-thread-id>
```

The observer posts:

- `context.snapshot`
  - `contextWindowUsedPct` when token-usage updates are available on the observer connection
  - `contextWindowSize`
  - `contextWindowTotalTokens`
  - `modelId`
  - generic primary/secondary rate-limit windows when available

This is the current Codex path for Claude `statusLine`-style telemetry.

Important limitation:

- The observer runs through a separate `codex app-server` connection from the
  plain `codex` CLI session.
- Per the official app-server contract, live `thread/tokenUsage/updated`
  notifications are tied to the active transport stream that owns the running
  turn.
- In plain `codex` mode, that means model and rate-limit telemetry are reliable,
  while context usage may be unavailable.

## 6. End-to-end check

1. Monitor server is running
2. `setup:external` has been run for the target project
3. Run `codex` from the target project root
4. Submit a prompt that causes one Bash command
5. Confirm the dashboard shows:
   - `context.saved`
   - `user.message`
   - `terminal.command`
   - `assistant.response`
6. Confirm the dashboard starts receiving `context.snapshot` events automatically

## 7. Current limitations

- No full app-server lifecycle integration yet
- No dedicated `SessionEnd` hook mapping
- No subagent hierarchy mapping in v1
- No hook-time interception for non-Bash tools
- Full item-level capture is still deferred to the app-server stage; the current observer only collects status-style telemetry

For the adapter internals and exact event mapping, see
[`packages/runtime/CODEX_DATA_FLOW.md`](https://github.com/belljun3395/agent-tracer/blob/main/packages/runtime/CODEX_DATA_FLOW.md)
in the repository.
