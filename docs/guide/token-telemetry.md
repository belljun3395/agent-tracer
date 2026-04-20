# Token Telemetry Setup

Agent Tracer collects token usage data through Claude Code's built-in
OpenTelemetry exporter. The exporter is **opt-in** and requires three
environment variables in addition to the standard `MONITOR_*` settings.
Without these variables Claude Code runs normally but no token data appears
in the dashboard.

## How it works

```
Claude Code ──(OTLP/HTTP)──► POST /v1/logs (monitor server)
                                    │
                              extractApiRequestRecords()
                                    │
                              LogTokenUsageUseCase
                                    │
                              timeline_events (kind: token.usage)
                                    │
                              Overview → Token Summary panel
```

Each API call Claude Code makes is logged as a `claude_code.api_request`
event containing `input_tokens`, `output_tokens`, `cache_read_tokens`,
`cache_creation_tokens`, `cost_usd`, `duration_ms`, and `model`. The
monitor server receives these events at `POST /v1/logs`, matches the
session to an active task via the runtime binding table, and stores them
as `token.usage` timeline events.

## Required environment variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `CLAUDE_CODE_ENABLE_TELEMETRY` | `1` | Activates the OTel exporter (opt-in gate) |
| `OTEL_LOGS_EXPORTER` | `otlp` | Routes log events (including `api_request`) to OTLP |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/json` | Matches the monitor server's HTTP/JSON endpoint |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://127.0.0.1:3847` | Monitor server base URL |

`OTEL_EXPORTER_OTLP_ENDPOINT` sets the base for all OTLP signals. The
monitor server appends `/v1/logs` automatically to form the full logs
endpoint.

## Quick setup

Run the bundled setup script once:

```bash
bash scripts/setup-telemetry.sh
```

The script appends the four variables to `~/.zshrc` (or `~/.bashrc` if
`.zshrc` is absent) and skips any variable that is already present.

Then reload your shell and restart Claude Code:

```bash
source ~/.zshrc   # or ~/.bashrc
# restart Claude Code
```

## Manual setup

If you prefer to set the variables yourself, add the following to your
shell profile (`~/.zshrc`, `~/.bashrc`, or equivalent):

```bash
# Agent Tracer — token telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:3847
```

If the monitor server runs on a non-default port or host, adjust
`OTEL_EXPORTER_OTLP_ENDPOINT` to match (e.g.
`http://192.168.1.10:4000`).

## Verify the setup

After restarting Claude Code, send any prompt and then check the
`/v1/logs` endpoint directly:

```bash
curl -s -X POST http://127.0.0.1:3847/v1/logs \
  -H "Content-Type: application/json" \
  -d '{"resourceLogs":[]}' | python3 -m json.tool
# expected: {"ok":true,"data":{"accepted":0,"skipped":0,"total":0}}
```

A healthy response confirms the endpoint is reachable. Token events
appear in the dashboard Overview tab under **Token Summary** after the
first API call completes.

To confirm data is flowing, query the database directly:

```bash
curl -s "http://127.0.0.1:3847/api/tasks" | \
  python3 -c "
import json, sys
tasks = json.load(sys.stdin)['tasks']
print('Latest tasks:')
for t in tasks[:3]:
    print(f\"  {t['id']} | {t['status']} | {t.get('displayTitle','')[:50]}\")
"
```

Pick a task ID and check its timeline for `token.usage` events:

```bash
TASK_ID=<your-task-id>
curl -s "http://127.0.0.1:3847/api/tasks/${TASK_ID}" | \
  python3 -c "
import json, sys
data = json.load(sys.stdin)
events = data.get('timeline', [])
token_events = [e for e in events if e['kind'] == 'token.usage']
print(f'token.usage events: {len(token_events)}')
for e in token_events:
    print(f\"  {e['title']}\")
"
```

## Known limitations

- **Subagent tokens are separate.** When Claude Code spawns a subagent
  via the `Agent` tool, the subagent runs in its own session and its API
  calls are attributed to the child task, not the parent. The parent
  task's Token Summary reflects only the parent session's API calls.

- **Approximate cost figures.** The `cost_usd` values reported by Claude
  Code are estimates. For authoritative billing data refer to the
  Anthropic Console (or your AWS Bedrock / Google Cloud Vertex dashboard).

- **5-second flush window.** Claude Code batches OTLP log events and
  flushes every 5 seconds. If a session ends within that window the
  monitor server falls back to the most recently started session for the
  same task, which is correct in the common case but may mis-attribute
  events when multiple sessions overlap.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| No `token.usage` events after restarting | Confirm `echo $CLAUDE_CODE_ENABLE_TELEMETRY` prints `1` in the terminal you launch Claude Code from |
| `curl /v1/logs` returns connection refused | Monitor server is not running — start it with `npm run dev:server` |
| Events arrive but `skipped` count is non-zero | The session ID in the OTLP payload did not match any active runtime binding — the session may have ended before the 5-second flush |
| Claude Code launched from a macOS GUI app shows no tokens | GUI launchers do not inherit `.zshrc` exports — launch Claude Code from a terminal or set the variables at the system level (`launchctl setenv …`) |
