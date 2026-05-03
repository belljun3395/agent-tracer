#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

// Always resolve to the MAIN repo (where perf/base is checked out), even when
// the bench script is invoked from inside a worktree. We use git's common-dir
// (worktrees share `.git` with the main repo) and walk up one level.
const repoRoot = (() => {
  const res = spawnSync("git", ["rev-parse", "--git-common-dir"],
    { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" });
  if (res.status === 0 && res.stdout.trim()) {
    return path.resolve(path.resolve(import.meta.dirname, ".."), res.stdout.trim(), "..");
  }
  return path.resolve(import.meta.dirname, "..");
})();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const options = parseArgs(process.argv.slice(2));
const iterations = intOption("iterations", 50);
const warmup = intOption("warmup", 10);
const concurrency = intOption("concurrency", 1);
const cpus = stringOption("cpus", "1.0");
const memory = stringOption("memory", "256m");
const serverBaseUrl = stringOption("server-base-url", "http://server:3847");
const hostPrometheus = stringOption("prometheus-url", "http://127.0.0.1:9090");
const network = stringOption("network", "agent-tracer-bench_default");
const dockerHost = process.env.DOCKER_HOST ?? "unix:///var/run/docker.sock";
const dockerConfig = process.env.DOCKER_CONFIG ?? "/tmp/docker-no-creds";
const outDir = path.resolve(repoRoot, stringOption("out-dir", `observability/results/docker-phase-bench/${timestamp}`));
const hooks = stringOption("hooks", "SessionStart,StatusLine,PreToolUse,UserPromptSubmit,PostToolUse/Bash")
  .split(",")
  .map((hook) => hook.trim())
  .filter(Boolean);

// AS-IS baseline: node + tsx + HTTP (production hook runner, no compilation).
// Each perf/phase* branch extends this array with the phase-specific TO-BE entry.
const phases = [
  {
    name: "baseline",
    description: "node + tsx + HTTP (AS-IS)",
    workdir: repoRoot,
    buildRuntime: false,
    transport: "http",
  },
  {
    name: "phase2-node-js",
    description: "node + compiled JS + HTTP (TO-BE)",
    workdir: path.join(repoRoot, ".worktrees/phase2-node-js"),
    buildRuntime: true,
    transport: "http",
  },
];

mkdirSync(outDir, { recursive: true });

const dockerEnv = {
  ...process.env,
  DOCKER_HOST: dockerHost,
  DOCKER_CONFIG: dockerConfig,
};

await main();

async function main() {
  run("docker", ["info", "--format", "{{.ServerVersion}}"], { env: dockerEnv });
  await waitHttp(`${hostPrometheus}/-/ready`, "Prometheus");
  await waitPrometheusServerUp();
  const results = [];
  for (const phase of phases) {
    if (results.length > 0) await resetServerState();
    results.push(await runPhase(phase));
  }
  const summary = {
    timestamp,
    resourceLimits: { cpus, memory },
    iterations,
    warmup,
    concurrency,
    hooks,
    serverBaseUrl,
    hostPrometheus,
    network,
    results,
  };
  const summaryPath = path.join(outDir, `docker-phase-summary-${timestamp}.json`);
  writeFileSync(summaryPath, JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nWROTE ${summaryPath}`);
  console.log(renderMarkdownTable(summary));
}

async function runPhase(phase) {
  if (!existsSync(phase.workdir)) throw new Error(`Missing worktree: ${phase.workdir}`);
  const image = `agent-tracer-runtime-bench:${phase.name}-${timestamp}`.toLowerCase();
  const container = `agent-tracer-bench-${phase.name}-${timestamp}`.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");
  const phaseOut = path.join(outDir, phase.name);
  mkdirSync(phaseOut, { recursive: true });

  const dockerfile = phase.dockerfile ?? "Dockerfile.benchmark-runtime";
  console.log(`\n=== build ${phase.name}: ${image} (${dockerfile}) ===`);
  run("docker", [
    "build",
    "-f", path.join(repoRoot, dockerfile),
    "--build-arg", `BUILD_RUNTIME=${phase.buildRuntime ? "true" : "false"}`,
    "-t", image,
    phase.workdir,
  ], { env: dockerEnv, timeoutMs: 15 * 60_000 });

  const label = `docker-${phase.name}-${timestamp}`;
  const command = buildContainerCommand(label, phase);
  const envArgs = [
    "-e", `MONITOR_BASE_URL=${serverBaseUrl}`,
    "-e", `MONITOR_TRANSPORT=${phase.transport}`,
    "-e", "NODE_ENV=production",
  ];
  if (phase.socket) envArgs.push("-e", `AGENT_TRACER_DAEMON_SOCKET=${phase.socket}`);
  if (phase.runtime) envArgs.push("-e", `RUNTIME=${phase.runtime}`);

  console.log(`\n=== run ${phase.name}: ${container} ===`);
  const startTs = Date.now() / 1000;
  run("docker", [
    "run", "-d",
    "--name", container,
    "--cpus", cpus,
    "--memory", memory,
    "--network", network,
    ...envArgs,
    image,
    "bash", "-lc", command,
  ], { env: dockerEnv });

  const stats = [];
  while (true) {
    const inspect = run("docker", ["inspect", "-f", "{{.State.Running}} {{.State.ExitCode}}", container], { env: dockerEnv, quiet: true });
    const [runningRaw, exitCodeRaw] = inspect.stdout.trim().split(/\s+/);
    collectStats(container, stats);
    if (runningRaw !== "true") {
      const exitCode = Number(exitCodeRaw);
      const logs = run("docker", ["logs", container], { env: dockerEnv, quiet: true, allowFailure: true }).stdout;
      writeFileSync(path.join(phaseOut, `${label}-container.log`), logs);
      if (exitCode !== 0) {
        throw new Error(`${phase.name} container failed with exit ${exitCode}. See ${path.join(phaseOut, `${label}-container.log`)}`);
      }
      break;
    }
    await sleep(1000);
  }
  const endTs = Date.now() / 1000;

  const copyDest = path.join(phaseOut, "container-results");
  rmSync(copyDest, { recursive: true, force: true });
  run("docker", ["cp", `${container}:/app/observability/results`, copyDest], { env: dockerEnv, allowFailure: true });
  // Phase 3 / 2+3: daemon writes to /root/.agent-tracer/daemon.log inside the container.
  // Copy before removal so failures are diagnosable even after the container is gone.
  run("docker", ["cp", `${container}:/root/.agent-tracer/daemon.log`,
      path.join(phaseOut, `${label}-daemon.log`)], { env: dockerEnv, allowFailure: true });
  run("docker", ["rm", container], { env: dockerEnv, allowFailure: true });

  const hookSummaries = readHookSummaries(copyDest, label);
  const prom = await queryPrometheusForWindow(startTs, endTs);
  const resource = summarizeStats(stats);
  const result = {
    phase: phase.name,
    description: phase.description,
    workdir: phase.workdir,
    image,
    label,
    startedAtUnix: startTs,
    finishedAtUnix: endTs,
    durationSeconds: round(endTs - startTs),
    hookSummaries,
    avgHookP99Ms: round(avg(hookSummaries.map((row) => row.p99Ms))),
    resource,
    prometheus: prom,
    artifacts: {
      containerLog: path.join(phaseOut, `${label}-container.log`),
      copiedResults: copyDest,
    },
  };
  writeFileSync(path.join(phaseOut, `${label}-result.json`), JSON.stringify(result, null, 2) + "\n");
  return result;
}

function buildContainerCommand(label, phase) {
  // bun containers don't have npm; invoke the benchmark script directly.
  const benchPrefix = phase.runtime === "bun"
    ? "bun scripts/benchmark-hooks.mjs"
    : "npm run bench:hook --";
  const parts = ["set -euo pipefail", "mkdir -p observability/results"];
  for (const hook of hooks) {
    parts.push(`${benchPrefix} --hook ${shellQuote(hook)} --iterations ${iterations} --warmup ${warmup} --concurrency ${concurrency} --label ${shellQuote(label)}`);
  }
  // No trailing sleep — container exit happens after the last hook bench
  // writes its summary file. The previous 'sleep 3' was a leftover safety
  // buffer that just added 6s/run × runs × phases to total wall clock.
  return parts.join("; ");
}

function readHookSummaries(copyDest, label) {
  const nestedResultRoot = path.join(copyDest, "results");
  const resultRoot = existsSync(nestedResultRoot) ? nestedResultRoot : copyDest;
  return hooks.map((hook) => {
    const safe = hook.replace(/[^a-zA-Z0-9_.-]+/g, "-");
    const file = path.join(resultRoot, `${label}-${safe}-summary.json`);
    const data = JSON.parse(readFileSync(file, "utf8"));
    return {
      hook,
      count: data.count,
      failures: data.failures,
      p50Ms: data.durationMs.p50,
      p95Ms: data.durationMs.p95,
      p99Ms: data.durationMs.p99,
      maxMs: data.durationMs.max,
      avgMs: data.durationMs.avg,
      summaryPath: file,
    };
  });
}

async function queryPrometheusForWindow(startTs, _endTs) {
  // Wait 1 scrape cycle (5s) so Prometheus has fresh post-benchmark data.
  // Previously 10s; reduced after metric-discovery already verifies series
  // existence at query time.
  await sleep(5_000);

  // Query at the actual current time, not at the stale endTs+5 value.
  const queryAt = Date.now() / 1000;
  const window = Math.max(60, Math.ceil(queryAt - startTs) + 30);

  const httpBase = await discoverHttpMetricBase();
  const [elP99Metric, elUtilMetric] = await discoverNodeMetrics();
  console.log(`[prom] http metric base: ${httpBase}`);
  console.log(`[prom] event loop metrics: ${elP99Metric}, ${elUtilMetric}`);

  const routes = [
    "/ingest/v1/sessions/ensure",
    "/ingest/v1/workflow",
    "/ingest/v1/tool-activity",
    "/ingest/v1/events",
  ];
  const routeStats = {};
  for (const route of routes) {
    routeStats[route] = {
      count: await scalar(`sum(increase(${httpBase}_count{http_route=${promString(route)}}[${window}s]))`, queryAt),
      p50Ms: await scalar(`histogram_quantile(0.50, sum by (le) (increase(${httpBase}_bucket{http_route=${promString(route)}}[${window}s]))) * 1000`, queryAt),
      p95Ms: await scalar(`histogram_quantile(0.95, sum by (le) (increase(${httpBase}_bucket{http_route=${promString(route)}}[${window}s]))) * 1000`, queryAt),
      p99Ms: await scalar(`histogram_quantile(0.99, sum by (le) (increase(${httpBase}_bucket{http_route=${promString(route)}}[${window}s]))) * 1000`, queryAt),
    };
  }
  // Refresh timestamp right before point-in-time gauge queries — these are
  // evaluated at a fixed instant, not over a range, so we want the most
  // recent value rather than the value at the stale pre-discovery queryAt.
  const gaugeAt = Date.now() / 1000;

  return {
    windowSeconds: round(window),
    queryAtUnix: queryAt,
    httpMetricBase: httpBase,
    routeStats,
    // `or vector(0)` so that zero 5xx responses returns 0 instead of null.
    server5xx: await scalar(`sum(increase(${httpBase}_count{http_response_status_code=~"5.."}[${window}s])) or vector(0)`, queryAt),
    // Use last_over_time so the gauge always resolves within the scrape window.
    eventLoopP99Seconds: await scalar(`last_over_time(${elP99Metric}[30s])`, gaugeAt),
    eventLoopUtilization: await scalar(`last_over_time(${elUtilMetric}[30s])`, gaugeAt),
    // v8js_memory_heap_used is split per heap space (read_only/new/old/code/etc.) — sum to get total.
    v8HeapUsedBytes: await scalar("sum(last_over_time(v8js_memory_heap_used[30s]))", gaugeAt),
  };
}

// Discover which HTTP server duration metric the OTel exporter actually emits.
// Stable semconv (OTEL_SEMCONV_STABILITY_OPT_IN=http) → http_server_request_duration
// Old semconv → http_server_duration
async function discoverHttpMetricBase() {
  const candidates = [
    "http_server_request_duration",
    "http_server_duration",
  ];
  for (const name of candidates) {
    const found = await firstExistingMetric(`${name}_count`);
    if (found) return name;
  }
  return "http_server_request_duration";
}

// Discover actual Node.js event loop metric names (OTel name changed across versions).
// Confirmed actual names for @opentelemetry/sdk-node ^0.205: nodejs_eventloop_delay_p99
async function discoverNodeMetrics() {
  const elP99 = await firstExistingMetric(
    "nodejs_eventloop_delay_p99",
    "nodejs_event_loop_delay_p99",
    "nodejs_eventloop_lag_p99_milliseconds",
  );
  const elUtil = await firstExistingMetric(
    "nodejs_eventloop_utilization",
    "nodejs_event_loop_utilization",
  );
  return [
    elP99 ?? "nodejs_eventloop_delay_p99",
    elUtil ?? "nodejs_eventloop_utilization",
  ];
}

async function firstExistingMetric(...names) {
  for (const name of names) {
    try {
      const url = `${hostPrometheus}/api/v1/query?${new URLSearchParams({ query: `{__name__=${promString(name)}}` })}`;
      const data = await fetchJson(url);
      if (data.data.result.length > 0) return name;
    } catch {}
  }
  return null;
}

async function scalar(query, ts) {
  const url = `${hostPrometheus}/api/v1/query?${new URLSearchParams({ query, time: ts.toFixed(3) })}`;
  try {
    const data = await fetchJson(url);
    const result = data.data.result;
    if (!result.length) return null;
    const value = Number(result[0].value[1]);
    return Number.isFinite(value) ? round(value) : null;
  } catch (err) {
    console.warn(`[prom] query failed (${query.slice(0, 80)}): ${err.message}`);
    return null;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} -> ${response.status}`);
  const data = await response.json();
  if (data.status && data.status !== "success") throw new Error(JSON.stringify(data));
  return data;
}

function collectStats(container, stats) {
  const res = run("docker", ["stats", "--no-stream", "--format", "{{json .}}", container], { env: dockerEnv, quiet: true, allowFailure: true });
  const line = res.stdout.trim();
  if (!line) return;
  try {
    const parsed = JSON.parse(line);
    stats.push({
      atUnix: Date.now() / 1000,
      raw: parsed,
      cpuPercent: parsePercent(parsed.CPUPerc),
      memUsageMiB: parseMemUsageMiB(parsed.MemUsage),
    });
  } catch {}
}

function summarizeStats(stats) {
  const activeStats = stats.filter((sample) => sample.memUsageMiB > 0 || sample.cpuPercent > 0);
  const cpu = activeStats.map((s) => s.cpuPercent).filter(Number.isFinite);
  const mem = activeStats.map((s) => s.memUsageMiB).filter(Number.isFinite);
  return {
    sampleCount: stats.length,
    activeSampleCount: activeStats.length,
    cpuPercentAvg: round(avg(cpu)),
    cpuPercentMax: round(max(cpu)),
    memoryMiBAvg: round(avg(mem)),
    memoryMiBMax: round(max(mem)),
    samples: stats,
  };
}

function parsePercent(value) {
  const n = Number(String(value).replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

function parseMemUsageMiB(value) {
  const first = String(value).split("/")[0]?.trim();
  if (!first) return null;
  const match = first.match(/^([0-9.]+)\s*([KMGT]?i?B)$/i);
  if (!match) return null;
  const n = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors = { b: 1 / 1024 / 1024, kb: 1 / 1024, kib: 1 / 1024, mb: 1, mib: 1, gb: 1024, gib: 1024, tb: 1024 * 1024, tib: 1024 * 1024 };
  return round(n * (factors[unit] ?? 1));
}

function renderMarkdownTable(summary) {
  const lines = [
    "| Variant | Runtime path | Avg hook p99 (ms) | CPU avg/max (%) | Mem avg/max (MiB) | 5xx | Event loop p99 (s) |",
    "|---|---|---:|---:|---:|---:|---:|",
  ];
  for (const result of summary.results) {
    const prom = result.prometheus;
    const fmt = (v) => v === null || v === undefined ? "—" : v;
    lines.push(`| ${result.phase} | ${result.description} | ${result.avgHookP99Ms} | ${result.resource.cpuPercentAvg}/${result.resource.cpuPercentMax} | ${result.resource.memoryMiBAvg}/${result.resource.memoryMiBMax} | ${fmt(prom.server5xx)} | ${fmt(prom.eventLoopP99Seconds)} |`);
  }
  return lines.join("\n");
}

async function resetServerState() {
  // Project name comes from docker-compose.yml `name:` field (run from repoRoot).
  // Use the user's default DOCKER_CONFIG so the compose CLI plugin is found —
  // dockerEnv overrides it to /tmp/docker-no-creds for build/run, but that
  // path has no cli-plugins/ dir so 'docker compose' would fail.
  console.log(`\n=== restarting server to reset state between phases ===`);
  const composeEnv = { ...dockerEnv };
  delete composeEnv.DOCKER_CONFIG;
  run("docker", ["compose", "restart", "server"],
      { env: composeEnv, cwd: repoRoot });
  // Confirm the server is back up via Prometheus (avoids relying on host port mapping).
  await waitPrometheusServerUp();
}

// Wait until Prometheus successfully scrapes the server (up == 1).
// This is more reliable than polling the host port because Docker Desktop
// does not always forward container ports to the macOS host after a
// manual network reconnect or container restart.
async function waitPrometheusServerUp() {
  console.log("[prom] waiting for server scrape to succeed (up == 1) …");
  for (let i = 0; i < 60; i += 1) {
    try {
      const url = `${hostPrometheus}/api/v1/query?${new URLSearchParams({ query: 'up{job="agent-tracer-server"}' })}`;
      const data = await fetchJson(url);
      const val = data.data.result[0]?.value[1];
      if (val === "1") {
        console.log("[prom] server is up");
        return;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error("Prometheus never saw the server come up (up{job=agent-tracer-server} != 1 after 60s)");
}

async function waitHttp(url, label) {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error(`${label} not ready: ${url}`);
}

function run(bin, args, opts = {}) {
  const res = spawnSync(bin, args, {
    cwd: opts.cwd ?? repoRoot,
    env: opts.env ?? process.env,
    encoding: "utf8",
    timeout: opts.timeoutMs ?? 300_000,
  });
  if (!opts.quiet) {
    console.log(`$ ${[bin, ...args].map(shellQuote).join(" ")}`);
    if (res.stdout) process.stdout.write(res.stdout);
    if (res.stderr) process.stderr.write(res.stderr);
  }
  if (res.error && !opts.allowFailure) throw res.error;
  if (res.status !== 0 && !opts.allowFailure) {
    throw new Error(`${bin} ${args.join(" ")} failed with ${res.status}`);
  }
  return { stdout: res.stdout ?? "", stderr: res.stderr ?? "", status: res.status };
}

function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq >= 0) parsed[arg.slice(2, eq)] = arg.slice(eq + 1);
    else {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) parsed[key] = args[++i];
      else parsed[key] = "true";
    }
  }
  return parsed;
}
function stringOption(key, fallback) { return options[key] === undefined ? fallback : String(options[key]); }
function intOption(key, fallback) { const n = Number.parseInt(String(options[key] ?? fallback), 10); if (!Number.isFinite(n)) throw new Error(`--${key} must be int`); return n; }
function shellQuote(value) { return `'${String(value).replace(/'/g, `'\\''`)}'`; }
function promString(value) { return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`; }
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function avg(values) { const xs = values.filter(Number.isFinite); return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function max(values) { const xs = values.filter(Number.isFinite); return xs.length ? Math.max(...xs) : 0; }
function round(value) { return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0; }
