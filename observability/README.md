# Observability — Prometheus + Grafana + k6

Reproducible measurement stack for Agent Tracer performance work. See
[`docs/guide/performance-plan.md`](../docs/perf/performance-plan.md) for the
AS-IS / TO-BE rationale and how each metric maps to a resume bullet.

## Layout

```
observability/
├── prometheus.yml                          # scrape config
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/prometheus.yml      # auto-wires Prometheus datasource
│   │   └── dashboards/dashboards.yml       # auto-loads JSON dashboards
│   └── dashboards/
│       └── agent-tracer.json               # main perf dashboard
└── k6/
    └── ingest-events.js                    # /ingest/v1/events load script
```

## Run

```bash
# Bring up server + prometheus + grafana, with the server pinned to 1 vCPU / 512MB.
bash scripts/start-docker.sh

# Open Grafana — anonymous Viewer is enabled, no login required.
open http://localhost:3000/d/agent-tracer-ingest

# Raw metrics (sanity check):
curl -s http://localhost:9464/metrics | head -30

# Run a server ingest benchmark (200 RPS, 2m, batch=5 by default).
docker compose --profile bench run --rm k6

# Override server benchmark knobs at the command line:
docker compose --profile bench run --rm \
  -e K6_RPS=400 -e K6_DURATION=5m -e K6_BATCH_SIZE=10 \
  k6

# Run a Claude Code hook wall-clock benchmark from this checkout.
# Use the same command on AS-IS, phase2, phase3, and phase2+3 worktrees.
npm run bench:hook -- --hook PreToolUse --iterations 100 --warmup 10 --label as-is-pretooluse
```

## What you get

| URL | What |
|---|---|
| http://localhost:3000 | Grafana — "Agent Tracer — Ingest Performance" dashboard |
| http://localhost:9090 | Prometheus UI (ad-hoc PromQL) |
| http://localhost:9464/metrics | Raw OTel metrics from server |
| http://localhost:3847 | Server API (unchanged) |

## Capturing AS-IS / TO-BE numbers

Use two complementary benchmark lanes:

| Lane | Command | Primary metrics |
|---|---|---|
| Server ingest | `docker compose --profile bench run --rm k6` | RPS, HTTP p50/p95/p99, 5xx rate, CPU/RSS/event-loop lag, batch size |
| Hook wall-clock | `npm run bench:hook -- --hook PreToolUse --iterations 100 --warmup 10 --label <variant>` | full hook process wall-clock p50/p95/p99, failures |

1. Run k6 against the **AS-IS** build (current branch's HEAD).
2. Run the hook benchmark against the same checkout and save the JSON summary.
3. Open Grafana, set time range to the test window, screenshot.
4. Note p50 / p95 / p99 from the Latency panel and avg/p95 from Batch Size.
5. Apply the change (Phase 2: tsx removal, Phase 3: daemon, or Phase 2+3).
6. Run both benchmarks again with the same parameters.
7. Capture again. Diff goes into the resume bullet table.

The `cpus: 1.0 / mem_limit: 512m` pin in `docker-compose.yml` is what makes
the comparison fair — without it, container scheduling noise drowns the
signal you're trying to show.

## Custom metrics emitted by the server

Auto-instrumented (`@opentelemetry/instrumentation-http`):

- `http_server_request_duration_{bucket,sum,count}` — HTTP latency histogram (stable semconv, opted-in via `OTEL_SEMCONV_STABILITY_OPT_IN=http`)
- `http_server_active_requests` — in-flight gauge

Custom (`IngestMetricsInterceptor`):

- `ingest_events_total{route, kind}` — counter
- `ingest_batch_size_{bucket,sum,count}{route}` — histogram (buckets 1, 2, 5, 10, 20, 50, 100, 200, 500)

Node runtime (auto):

- `nodejs_eventloop_delay_*` — event-loop delay gauges/histograms, including `nodejs_eventloop_delay_p99`
- `nodejs_eventloop_utilization` — event-loop utilization gauge
- `v8js_memory_heap_used` — heap usage signal

Measured on 2026-05-03 with the Docker stack, the Prometheus exporter exposed the auto HTTP, Node event-loop, and V8 metrics above. The `ingest_events_total` / `ingest_batch_size_*` instruments are still documented as intended server custom metrics, but they did not appear in `/metrics` during the live run and should be checked before relying on those Grafana panels.
