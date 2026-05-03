# Phase 3 Deep Dive — Local Daemon + Unix Domain Socket Transport

Phase 3 moves monitor delivery out of the short-lived Claude Code hook process.

## Problem

Before Phase 3, each hook process did all of this synchronously:

1. start shell runner + `tsx`
2. parse hook stdin
3. build domain events
4. call monitor HTTP endpoints directly
5. wait for the monitor response or network failure
6. exit

For non-blocking Claude Code hooks this is the wrong latency shape. Claude Code pays the network/monitor latency even though the hook result does not need the monitor response.

## Change

The runtime transport now defaults to a local daemon path:

```text
hook process -> Unix Domain Socket -> local daemon -> monitor HTTP API
```

The hook process only writes a JSON-line message to the daemon's UDS socket, then exits. The daemon owns the slower HTTP work.

## Session ensure handling

Existing hooks need `taskId` and `sessionId` before they can create events. Phase 3 returns deterministic local IDs immediately for `/ingest/v1/sessions/ensure` and enqueues the real ensure request to the daemon.

The daemon processes messages in order. When the monitor returns canonical IDs, the daemon records a mapping:

```text
local task/session ids -> monitor task/session ids
```

Subsequent queued event payloads are rewritten to the canonical monitor IDs before HTTP delivery when a mapping is available.

This preserves the hook's fire-and-forget latency profile while keeping server-side IDs canonical once the monitor is reachable.

## Runtime controls

Default transport mode is daemon/UDS. Use the environment to override:

```bash
MONITOR_TRANSPORT=http      # direct HTTP path
MONITOR_TRANSPORT=daemon    # local daemon + UDS path
AGENT_TRACER_DAEMON_SOCKET=/tmp/agent-tracer.sock
AGENT_TRACER_DAEMON_AUTOSTART=0  # tests/manual runs can disable daemon autostart
```

The daemon child sets `AGENT_TRACER_DAEMON_CHILD=1` so its own HTTP transport does not recursively enqueue back into itself.

## Benchmark

To isolate the Phase 3 effect, the benchmark used a fake monitor that delays every POST by `100ms`. This models a monitor/server/network path that is slower than local IPC.

Conditions:

```text
hooks: SessionStart, StatusLine, PreToolUse, UserPromptSubmit, PostToolUse/Bash
iterations: 30
warmup: 5
concurrency: 1
fake monitor: 127.0.0.1:3999, 100ms delay per POST
AS-IS: MONITOR_TRANSPORT=http
Phase 3: MONITOR_TRANSPORT=daemon, UDS autostart enabled
```

| Hook | AS-IS p99 | Phase 3 p99 | Delta |
|---|---:|---:|---:|
| `SessionStart` | 460.09ms | 173.66ms | 62.3% ↓ |
| `StatusLine` | 464.11ms | 167.82ms | 63.8% ↓ |
| `PreToolUse` | 301.49ms | 169.39ms | 43.8% ↓ |
| `UserPromptSubmit` | 302.11ms | 170.39ms | 43.6% ↓ |
| `PostToolUse/Bash` | 459.59ms | 175.80ms | 61.7% ↓ |
| **Average** | **397.48ms** | **171.41ms** | **56.9% ↓** |

## Interpretation

Phase 3 does not remove `tsx` startup. That is Phase 2's job. Phase 3 removes synchronous monitor HTTP waiting from the hook path.

That means:

- hooks with two monitor calls, such as `SessionStart`, benefit more under delayed HTTP
- hooks with one monitor call, such as `PreToolUse` and `UserPromptSubmit`, still improve materially
- remaining latency is mostly shell + `tsx` startup + hook import/evaluate cost

This is why Phase 2 and Phase 3 are complementary:

```text
Phase 2: reduce process/import/TypeScript startup cost
Phase 3: remove synchronous monitor/network wait
Phase 2+3: should attack both major cost centers
```

## Caveats

- The benchmark used a controlled fake monitor delay, not the Docker k6 server ingest benchmark.
- Docker daemon was previously unavailable, so full Prometheus/Grafana ingest validation still needs to be run separately.
- The daemon currently prioritizes hook latency over guaranteed synchronous delivery. Strict delivery can still use `MONITOR_TRANSPORT=http`.
